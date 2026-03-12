from __future__ import annotations

import logging
import requests
from pathlib import Path
from typing import List

from .models import DailyObservation, Element, Station
from .parsers import parse_stations_file, parse_inventory_file

logger = logging.getLogger(__name__)


class GHCNRepository:
    def __init__(self) -> None:
        self.sample_data_dir = Path("/app/data/sample")
        self.aws_base = "https://noaa-ghcn-pds.s3.amazonaws.com/csv"
        self._stations = []
        self._inventory = []
        self._load_metadata()

    def _load_metadata(self):
        try:
            stations_file = self.sample_data_dir / "ghcnd-stations.txt"
            if stations_file.exists():
                self._stations = parse_stations_file(stations_file)
                logger.info(f"{len(self._stations)} Stationen geladen")
        except Exception as e:
            logger.error(f"Fehler beim Laden der Stationen: {e}")

        try:
            inventory_file = self.sample_data_dir / "ghcnd-inventory.txt"
            if inventory_file.exists():
                self._inventory = parse_inventory_file(inventory_file)
                logger.info(f"{len(self._inventory)} Inventory-Records geladen")
        except Exception as e:
            logger.error(f"Fehler beim Laden des Inventory: {e}")

    def load_stations(self) -> List[Station]:
        return self._stations

    def load_inventory(self) -> List:
        return self._inventory

    def load_station_observations(self, station_id: str, start: int, end: int) -> List[DailyObservation]:
        obs = []
        for year in range(start, end + 1):
            try:
                url = f"{self.aws_base}/{year}.csv"
                response = requests.get(url, timeout=10)
                
                if response.status_code != 200:
                    continue
                
                lines = response.text.strip().split('\n')
                for line in lines:
                    try:
                        parts = line.split(',')
                        if len(parts) < 7:
                            continue
                        if parts[0] != station_id:
                            continue
                        if parts[2] not in ['TMIN', 'TMAX']:
                            continue
                        if parts[3] in ['', '-9999']:
                            continue
                        
                        date = parts[1]
                        obs.append(DailyObservation(
                            station_id=station_id,
                            date=date,
                            year=int(date[0:4]),
                            month=int(date[4:6]),
                            day=int(date[6:8]),
                            element=Element(parts[2]),
                            value_c=int(parts[3])/10.0,
                            qflag=None
                        ))
                    except:
                        continue
                        
            except Exception as e:
                logger.debug(f"Fehler bei Jahr {year}: {e}")
                continue
        
        logger.info(f"{len(obs)} Beobachtungen für {station_id}")
        return obs