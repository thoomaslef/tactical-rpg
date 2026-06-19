import { MapData } from './MapLoader';
import mapC from './data/map_c.json';
import mapN from './data/map_n.json';
import mapS from './data/map_s.json';
import mapE from './data/map_e.json';
import mapO from './data/map_o.json';
import mapSE from './data/map_se.json';
import mapDungeonRaz from './data/map_dungeon_raz.json';
import mapForet    from './data/map_foret.json';
import mapForetO   from './data/map_foret_o.json';
import mapForetE   from './data/map_foret_e.json';
import mapForetNo  from './data/map_foret_no.json';
import mapForetO2  from './data/map_foret_o2.json';

const MAPS: Record<string, MapData> = {
  map_c:            mapC            as unknown as MapData,
  map_n:            mapN            as unknown as MapData,
  map_s:            mapS            as unknown as MapData,
  map_e:            mapE            as unknown as MapData,
  map_o:            mapO            as unknown as MapData,
  map_se:           mapSE           as unknown as MapData,
  map_dungeon_raz:  mapDungeonRaz   as unknown as MapData,
  map_foret:        mapForet        as unknown as MapData,
  map_foret_o:      mapForetO       as unknown as MapData,
  map_foret_e:      mapForetE       as unknown as MapData,
  map_foret_no:     mapForetNo      as unknown as MapData,
  map_foret_o2:     mapForetO2      as unknown as MapData,
};

export class MapManager {
  public currentMap: MapData | null = null;

  loadMap(id: string): MapData {
    const map = MAPS[id];
    if (!map) throw new Error(`Map not found: ${id}`);
    this.currentMap = map;
    return map;
  }

  getByCoords(cx: number, cy: number): MapData | null {
    for (const map of Object.values(MAPS)) {
      if (map.coords && map.coords[0] === cx && map.coords[1] === cy) return map;
    }
    return null;
  }
}
