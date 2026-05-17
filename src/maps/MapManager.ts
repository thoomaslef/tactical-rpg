import { MapData } from './MapLoader';
import villageCentre from './data/village_centre.json';
import foretOuest from './data/foret_ouest.json';
import plaineNord from './data/plaine_nord.json';
import ruinesEst from './data/ruines_est.json';

const MAPS: Record<string, MapData> = {
  village_centre: villageCentre as MapData,
  foret_ouest: foretOuest as MapData,
  plaine_nord: plaineNord as MapData,
  ruines_est: ruinesEst as MapData,
};

export class MapManager {
  public currentMap: MapData | null = null;

  loadMap(id: string): MapData {
    const map = MAPS[id];
    if (!map) throw new Error(`Map not found: ${id}`);
    this.currentMap = map;
    return map;
  }
}
