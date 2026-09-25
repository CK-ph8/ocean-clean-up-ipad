import { Game } from './scenes/game.js';

const config = {
    type: Phaser.AUTO,
    title: 'Ocean Clean Up',
    description: '',
    parent: 'game-container',
    width: 1280,
    height: 720,
    backgroundColor: '#0492C2',
    pixelArt: false,
    scene: [
        Game
    ],
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH
    },
    input: {
        activePointers: 3 // Enables multi-touch support for iPad controls
    },
    physics: {
        default: 'arcade',
        arcade: {
            gravity: {
                x: 0,
                y: 200
            },
            debug: false
        }
    }
};

new Phaser.Game(config);