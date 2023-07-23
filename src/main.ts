import Phaser from 'phaser'

import StartPlayerScene from './scenes/StartPlayerScene'

const config: Phaser.Types.Core.GameConfig = {
    width: window.innerWidth,
    height: window.innerHeight,
    type: Phaser.AUTO,
    scene: [
        StartPlayerScene
    ],
    backgroundColor: 0x222222,
    fps: {
        forceSetTimeOut: true,
        target: 30
    }
}

const game = new Phaser.Game(config)