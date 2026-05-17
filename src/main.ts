import Phaser from 'phaser';
import { WorldScene } from './scenes/WorldScene';
import { PreloadScene } from './scenes/PreloadScene';
import { CombatScene } from './scenes/CombatScene';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#0e1320',
  scale: {
    mode: Phaser.Scale.RESIZE,
    width: '100%',
    height: '100%'
  },
  render: { antialias: true, pixelArt: false },
  scene: [WorldScene, PreloadScene, CombatScene]
};

new Phaser.Game(config);
