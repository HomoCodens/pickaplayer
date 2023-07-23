import Phaser, { GameObjects, Geom, Math, Input, Display } from 'phaser'
import Voronoy from '../util/Voronoy'

export default class BallsScene extends Phaser.Scene {
    balls: GameObjects.Arc[] = []
    currentlyDragging: boolean = false
    triangles: Geom.Triangle[] = []
    voronoy: Voronoy = null
    voronoyDebug: GameObjects.Graphics
    cells: GameObjects.Graphics[] = []

    create() {
        this.input.on(Input.Events.POINTER_DOWN, this.pointerDown, this)
        this.input.on(Input.Events.POINTER_UP, this.pointerUp, this)

        this.input.mouse?.disableContextMenu()

        this.voronoy = new Voronoy()
        this.voronoyDebug = this.add.graphics()
    }

    update(t, dt) {
        if(this.isDragging()) {
            const ballPositions: Math.Vector2[] = this.balls.map((b) => new Math.Vector2(b.x, b.y))
            const cornerPositions: Math.Vector2[] = [
                new Math.Vector2(-this.scale.width, -this.scale.height),
                new Math.Vector2(-this.scale.width, 2*this.scale.height),
                new Math.Vector2(2*this.scale.width, 2*this.scale.height),
                new Math.Vector2(2*this.scale.width, -this.scale.height)
            ]
            this.voronoy.setPoints([...ballPositions, ...cornerPositions])
            
            /*this.voronoyDebug.clear()
            this.voronoy.drawDebug(this.voronoyDebug)*/

            this.cells.forEach((c) => c.clear())
            this.voronoy.getVoronoyPolygons().forEach((p, i) => {
                if(i < this.cells.length) {
                    this.cells[i].fillPoints(p.points, true)
                    this.cells[i].strokePoints(p.points, true)
                }
            })
        }
    }

    pointerDown(pointer: Input.Pointer, targets: GameObjects.GameObject[]): void {
        if(pointer.button === 0) {
            if(targets.length === 0) {
                this.addBall(pointer.position, pointer)
            }
        }
    }

    pointerUp(pointer: Input.Pointer, targets: GameObjects.GameObject[]): void {
        if(((pointer.id === 0 && pointer.button === 2) || pointer.id > 0) && targets.length > 0) {
            this.removeBall(targets[0])
        }
    }

    addBall(pos: Math.Vector2, pointer: Input.Pointer): void {
        const ball = this.add.circle(pos.x, pos.y, 30, Display.Color.RandomRGB(0, 200).color, 1)
        ball.setInteractive()
        this.input.setDraggable(ball)
        ball.on(Phaser.Input.Events.GAMEOBJECT_DRAG,
            (pointer, x, y) => {
                ball.x = x
                ball.y = y
            }
            )
            ball.on(Phaser.Input.Events.DRAG_START, () => this.currentlyDragging = true, this)
            ball.on(Phaser.Input.Events.DRAG_END, () => this.currentlyDragging = false, this)
            this.balls.push(ball)
        
        const cell = this.add.graphics({ fillStyle: { color: ball.fillColor }, lineStyle: { width: 3, color: 0xeeeeee }})
        this.cells.push(cell)
        
        this.tweens.killAll()
        const winner = Phaser.Math.Between(0, this.cells.length - 1)
        this.cells.forEach((c, i) => {
            this.tweens.add({
                targets: c,
                alpha: [0, 1],
                ease: 'expo.in',
                duration: 2200,
                onComplete: (tween, target, params) => {
                    if(i !== winner) {
                        this.tweens.add({
                            targets: c,
                            alpha: 0,
                            ease: 'linear',
                            duration: 1000
                        })
                    }
                }
            })
        })
    }

    removeBall(target: GameObjects.GameObject): void {
        const indexToRemove = this.balls.indexOf(target as GameObjects.Arc)
        this.balls.splice(indexToRemove, 1)
        target.destroy()

        this.cells[indexToRemove].destroy()
        this.cells.splice(indexToRemove, 1)
    }

    isDragging(): boolean {
        return this.currentlyDragging
    }
}