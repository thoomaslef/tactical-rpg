import Phaser from 'phaser';
import { MapScene } from './scenes/MapScene';
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
  scene: [MapScene, PreloadScene, CombatScene]
};

new Phaser.Game(config);
