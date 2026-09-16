/**
 * Scene Audio Bridge Hook & Factory for The Last Signal.
 *
 * Convenience connector providing clean initialization of the AudioBridge.
 */
import { AudioBridge, type AudioBridgeOptions } from '../AudioBridge';

export function createAudioBridge(options: AudioBridgeOptions): AudioBridge {
  return new AudioBridge(options);
}

export { AudioBridge, type AudioBridgeOptions };
