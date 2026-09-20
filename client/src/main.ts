import Phaser from 'phaser';
import { TableScene } from './scenes/TableScene.ts';

new Phaser.Game({
  type: Phaser.AUTO, // WebGL when available
  parent: 'game',
  backgroundColor: '#0d1512',
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH, width: 1600, height: 900 },
  scene: [TableScene],
});
