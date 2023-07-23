import { Geom, Math } from 'phaser'

class TriangulationVertex extends Math.Vector2 {
    id: integer

    constructor(x: number, y: number, id: integer) {
        super(x, y)
        this.id = id
    }
}

class TriangulationFace {
    triangle: Geom.Triangle = null
    circumCircle: Geom.Circle = null
    vertex1: TriangulationVertex
    vertex2: TriangulationVertex
    vertex3: TriangulationVertex

    constructor(vertex1: TriangulationVertex, vertex2: TriangulationVertex, vertex3: TriangulationVertex) {
        this.vertex1 = vertex1
        this.vertex2 = vertex2
        this.vertex3 = vertex3
    }

    getTriangle(): Geom.Triangle {
        if(!this.triangle) {
            this.triangle = new Geom.Triangle(
                this.vertex1.x, this.vertex1.y,
                this.vertex2.x, this.vertex2.y,
                this.vertex3.x, this.vertex3.y
            )
        }

        return this.triangle
    }

    getCircumCircle(): Geom.Circle {
        if(!this.circumCircle) {
            this.circumCircle = Geom.Triangle.CircumCircle(this.getTriangle())
        }

        return this.circumCircle
    }

    getCircumCenter(): Math.Vector2 {
        const cc = this.getCircumCircle()
        return new Math.Vector2(cc.x, cc.y)
    }

    getVertexIds(): integer[] {
        return [this.vertex1.id, this.vertex2.id, this.vertex3.id]
    }

    containsVertexId(id: integer): boolean {
        return this.vertex1.id === id || this.vertex2.id === id || this.vertex3.id === id
    }
}

export default class Voronoy {
    triangulationFaces: TriangulationFace[] = []
    triangulationVertices: TriangulationVertex[] = []
    voronoyPolygons: Geom.Polygon[] = []
    nodes: Math.Vector2[] = []

    setPoints(points: Math.Vector2[], threshold: number = 0): void {
        if(points.length == this.nodes.length) {
            const se = points.map((p, i) => {
                return Math.Distance.BetweenPointsSquared(p, this.nodes[i])
            })
            .reduce((a, b) => a + b)
            
            if(se < threshold) {
                return
            }
        }

        this.nodes = points
        
        this.clear()
    }
    
    clear(): void {
        this.triangulationFaces = []
        this.voronoyPolygons = []
    }

    getTriangulation() {
        this.calculateTriangulation()
        return this.triangulationFaces
    }

    calculateTriangulation(force: boolean = false): void {
        if(this.nodes.length < 3) {
            return
        }

        if(!force && this.triangulationFaces.length > 0) {
            return
        }

        // Start with two triangles guaranteed to contain all points
        // [/]
        // (works for our application but should really be a single triangle)
        let bounds = this.getExtendedBounds()

        let integratedVertices: TriangulationVertex[] = [
            new TriangulationVertex(bounds.left, bounds.top, 0),
            new TriangulationVertex(bounds.left, bounds.bottom, 1),
            new TriangulationVertex(bounds.right, bounds.bottom, 2),
            new TriangulationVertex(bounds.right, bounds.top, 3)
        ]

        let faces = [
            new TriangulationFace(integratedVertices[0], integratedVertices[1], integratedVertices[3]), // [/
            new TriangulationFace(integratedVertices[1], integratedVertices[2], integratedVertices[3]), // /]
        ]

        for(let node of this.nodes) {
            const nodeId = integratedVertices.length
            const vertex = new TriangulationVertex(node.x, node.y, nodeId)
            integratedVertices.push(vertex)

            const badFaceFlags = faces.map((f) => {
                return f.getCircumCircle().contains(node.x, node.y)
            })

            const badFaces = faces.filter((_, i) => badFaceFlags[i])
            const goodFaces = faces.filter((_, i) => !badFaceFlags[i])

            const holeVertexIds = Array.from(new Set(badFaces.flatMap((f) => f.getVertexIds())))

            // sorted by ascending angle from x axis i.e. ccw around node
            const holeVertices = holeVertexIds
                                .map((i) => integratedVertices[i])
                                .sort(this.sortByAngleAround(node))
            
            for(let i = 1; i < holeVertices.length; i++) {
                goodFaces.push(new TriangulationFace(holeVertices[i - 1], holeVertices[i], vertex))
            }
            goodFaces.push(new TriangulationFace(holeVertices[holeVertices.length - 1], holeVertices[0], vertex))

            faces = goodFaces
        }

        // cull helper triangles
        faces = faces.filter((f) => !(f.containsVertexId(0) || 
                                        f.containsVertexId(1) || 
                                        f.containsVertexId(2) || 
                                        f.containsVertexId(3)))

        this.triangulationFaces = faces
        this.triangulationVertices = integratedVertices.slice(4)
    }

    getExtendedBounds(): Geom.Rectangle {
        let bounds = Geom.Rectangle.FromPoints(this.nodes)
        bounds = Geom.Rectangle.Scale(bounds, 1.1, 1.1)
        bounds = Geom.Rectangle.Offset(bounds, -bounds.width * 0.05, -bounds.height * 0.05)
        return bounds
    }

    sortByAngleAround(center: Math.Vector2) {
        return (a: Math.Vector2, b: Math.Vector2): number => {
            return Math.Angle.BetweenPoints(a, center) -
                    Math.Angle.BetweenPoints(b, center)
        } 
    }

    drawDebug(graphics: Phaser.GameObjects.Graphics): void {
        console.log(`haz ${this.getVoronoyPolygons().length} polys`)

        graphics.lineStyle(1, 0x999999)

        for(let f of this.getTriangulation()) {
            graphics.strokeTriangleShape(f.getTriangle())
        }

        graphics.lineStyle(1, 0xff0000, 0.145)
        graphics.fillStyle(0xff0000)
        for(let f of this.getTriangulation()) {
            const cc = f.getCircumCircle()
            graphics.strokeCircleShape(cc)
            graphics.fillCircle(cc.x, cc.y, 3)
        }

        graphics.lineStyle(2, 0x00ff00, 0.2)
        for(let p of this.getVoronoyPolygons()) {
            graphics.strokePoints(p.points, true)
            //graphics.fillPoints(p.points, true)
        }
    }

    getVoronoyPolygons(): Geom.Polygon[] {
        this.calculateTriangulation()
        this.calculateVoronoyPolygons()
        return this.voronoyPolygons
    }

    calculateVoronoyPolygons() {
        this.calculateTriangulation()
        if(this.voronoyPolygons.length > 0) {
            return
        }

        this.voronoyPolygons = this.triangulationVertices.map((v) => {
            const polyVertices = this.triangulationFaces
                                .filter((f) => f.containsVertexId(v.id))
                                .map((f) => f.getCircumCenter())
                                .sort(this.sortByAngleAround(v))
            return new Geom.Polygon(polyVertices)
        })
    }
}