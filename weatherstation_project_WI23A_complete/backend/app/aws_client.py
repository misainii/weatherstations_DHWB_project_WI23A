from __future__ import annotations

import logging
import csv
import requests
from typing import List, Dict, Any
from datetime import datetime

from .models import DailyObservation, Element

logger = logging.getLogger(__name__)


class AWSGHCNClient:
    """Einfacher AWS Client ohne Cache und komplexe Features"""
    
    BASE_URL = "https://noaa-ghcn-pds.s3.amazonaws.com/csv"
    
    def get_station_data(self, station_id: str, year: int) -> List[Dict[str, Any]]:
        """Lädt Daten für eine Station in einem Jahr"""
        url = f"{self.BASE_URL}/{year}.csv"
        observations = []
        
        try:
            response = requests.get(url, timeout=10)
            if response.status_code != 200:
                return []
            
            lines = response.text.strip().split('\n')
            for line in lines:
                parts = line.split(',')
                if len(parts) < 7:
                    continue
                    
                if parts[0] != station_id:
                    continue
                    
                element = parts[2]
                if element not in ['TMIN', 'TMAX']:
                    continue
                    
                value = parts[3]
                if value in ['', '-9999']:
                    continue
                    
                qflag = parts[5] if len(parts) > 5 else ''
                if qflag and qflag.strip():
                    continue
                
                date_str = parts[1]
                year_val = int(date_str[0:4])
                month_val = int(date_str[4:6])
                day_val = int(date_str[6:8])
                
                observations.append({
                    'station_id': station_id,
                    'date': date_str,
                    'year': year_val,
                    'month': month_val,
                    'day': day_val,
                    'element': element,
                    'value': int(value) / 10.0
                })
            
            return observations
            
        except Exception as e:
            logger.error(f"Fehler beim Laden von {station_id} für {year}: {e}")
            return []