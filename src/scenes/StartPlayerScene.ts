import { GameObjects, Geom, Math, Input, Display, Scene } from 'phaser'
import Voronoy from '../util/Voronoy'

export const StartPlayerStates = {
    WAITING: 0,
    PULSING_ONE_TOUCH: 1,
    RUNNING: 2,
    DONE: 3
}

export default class BallsScene extends Scene {
    currentlyDragging: boolean = false
    triangles: Geom.Triangle[] = []
    voronoy: Voronoy = null
    voronoyDebug: GameObjects.Graphics
    cells: GameObjects.Graphics[] = []
    pointers: Input.Pointer[] = []
    nActivePointers: integer = 0
    colors: number[] = Array(10).fill(0).map((i) => Display.Color.RandomRGB(0, 200).color)
    
    debug: boolean = false
    debugText: GameObjects.Text
    state: integer = StartPlayerStates.WAITING

    create() {
        this.input.on(Input.Events.POINTER_DOWN, this.pointerDown, this)
        this.input.on(Input.Events.POINTER_UP, this.pointerUp, this)

        this.input.mouse?.disableContextMenu()

        this.voronoy = new Voronoy()
        this.voronoyDebug = this.add.graphics()

        this.pointers = [this.input.pointer1, this.input.pointer2, ...this.input.addPointer(6)]
        this.debugText = this.add.text(0, 0, '')
        this.debugText.setDepth(100)
    }

    update() {
        if(this.debug) {
            this.debugText.setText([
                `nActivePointers = ${this.nActivePointers}`,
                `this.activePointers().length = ${this.activePointers().length}`,
                `state = ${this.state}`,
                ...this.pointers.map((p) => `id: ${p.id}, down: ${p.isDown}, x: ${p.x}, y: ${p.y}`),
            ])
        }

        this.updateVoronoy()

        this.drawCells()
    }

    updateVoronoy(): void {
        const pointerPositions: Math.Vector2[] = this.activePointers()
                                                    .map((p) => new Math.Vector2(p.x, p.y))
        const cornerPositions: Math.Vector2[] = [
            new Math.Vector2(-this.scale.width, -this.scale.height),
            new Math.Vector2(-this.scale.width, 2*this.scale.height),
            new Math.Vector2(2*this.scale.width, 2*this.scale.height),
            new Math.Vector2(2*this.scale.width, -this.scale.height)
        ]
        this.voronoy.setPoints([...pointerPositions, ...cornerPositions], 15)
    }

    drawCells(): void {
        this.cells.forEach((c) => c.clear())
            this.voronoy.getVoronoyPolygons().forEach((p, i) => {
                if(i < this.cells.length) {
                    this.cells[i].fillPoints(p.points, true)
                    this.cells[i].strokePoints(p.points, true)
                }
            })
    }

    pointerDown(): void {
        this.nActivePointers++

        this.onPointersChange()
    }

    pointerUp(pointer: Input.Pointer, targets: GameObjects.GameObject[]): void {
        this.nActivePointers--

        this.onPointersChange()
    }

    onPointersChange() {
        if(this.nActivePointers == 1) {
            this.state = StartPlayerStates.PULSING_ONE_TOUCH
        } else if(this.nActivePointers > 1) {
            this.start()
        }
    }

    activePointers(): Input.Pointer[] {
        return this.pointers.filter((p) => p && p.isDown)
    }

    start(): void {
        this.state = StartPlayerStates.RUNNING

        if(this.cells.length) {
            this.cells.forEach((c) => c.destroy())
            this.cells = []
        }

        this.activePointers().forEach((p, i) => {
            const cell = this.add.graphics({
                fillStyle: {
                    color: this.colors[i]
                },
                lineStyle: {
                    width: 3,
                    color: 0xeeeeee
                }
            })
            this.cells.push(cell)
        })
        
        this.tweens.killAll()
        const winner = Math.Between(0, this.cells.length - 1)
        this.tweens.chain({
            onComplete: () => this.state = StartPlayerStates.DONE,
            tweens: [
                {
                    targets: this.cells,
                    alpha: [0, 1],
                    ease: 'expo.in',
                    duration: 2200
                },
                {
                    targets: this.cells.filter((_, i) => i !== winner),
                    alpha: 0.1,
                    ease: 'linear',
                    duration: 500
                }
            ]
        })
    }
}