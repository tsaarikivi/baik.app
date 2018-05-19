import { HttpClient } from '@angular/common/http';
import { Component, OnDestroy, OnInit } from '@angular/core';
import * as mapboxgl from 'mapbox-gl';
import { BehaviorSubject, Subscription } from 'rxjs';
import { filter, first, map, tap } from 'rxjs/operators';
import { environment } from '../../environments/environment';

interface Station {
  id: string;
  name: string;
  state: string;
  bikesAvailable: number;
  spacesAvailable: number;
  allowDropoff: boolean;
  isFloatingBike: false;
  realTimeData: boolean;
  networks: string[];
  x: number;
  y: number;
}

interface QueryResult {
  stations: Station[];
}

@Component({
  selector: 'app-map',
  templateUrl: './map.component.html',
  styleUrls: ['./map.component.scss']
})
export class MapComponent implements OnInit, OnDestroy {
  loading: boolean;
  subscription: Subscription;
  geolocation: Geolocation;
  coordinates = new BehaviorSubject<{ latitude: number; longitude: number }>(
    null
  );
  map: mapboxgl.Map;

  constructor(private http: HttpClient) {
    Object.getOwnPropertyDescriptor(mapboxgl, 'accessToken').set(
      environment.mapboxApiKey
    );
  }

  ngOnInit() {
    this.geolocation = navigator.geolocation;
    this.buildMap();
    this.getCurrentPosition();
    this.subscribePosition();
  }

  getCurrentPosition() {
    this.loading = true;
    if (this.geolocation) {
      this.geolocation.getCurrentPosition(position => {
        const { latitude, longitude } = position.coords;
        this.coordinates.next({ latitude, longitude });
        this.loading = false;
      });
    }
  }

  private getMarkers = () => {
    return this.http
      .get<QueryResult>(
        'https://api.digitransit.fi/routing/v1/routers/hsl/bike_rental'
      )
      .pipe(first(), map(data => data.stations));
  };

  private getAvailableMarkers = () => {
    return this.getMarkers()
      .pipe(
        map((stations: Station[]) => {
          return stations.filter(station => station.bikesAvailable > 0);
        }),
        map(this.mapToFeatures)
      )
      .subscribe((features: any) => {
        this.map.loadImage('assets/icons/yellow.png', (err, image) => {
          if (err) {
            console.error(err);
          }
          this.map.addImage('gogo', image);
          this.map.addLayer({
            id: 'gogo-markers',
            type: 'symbol',
            source: {
              type: 'geojson',
              data: {
                type: 'FeatureCollection',
                features
              }
            },
            layout: {
              'icon-image': 'gogo',
              'text-field': '{title}',
              'text-font': ['Open Sans Semibold', 'Arial Unicode MS Bold'],
              'text-offset': [0, 0.55],
              'text-anchor': 'bottom'
            }
          });
        });
      });
  };

  private getUnavailableMarkers = () => {
    return this.getMarkers()
      .pipe(
        map((stations: Station[]) => {
          return stations.filter(station => station.bikesAvailable <= 0);
        }),
        map(this.mapToFeatures)
      )
      .subscribe((features: any) => {
        this.map.loadImage('assets/icons/white.png', (err, image) => {
          if (err) {
            console.error(err);
          }
          this.map.addImage('nogo', image);
          this.map.addLayer({
            id: 'nogo-markers',
            type: 'symbol',
            source: {
              type: 'geojson',
              data: {
                type: 'FeatureCollection',
                features
              }
            },
            layout: {
              'icon-image': 'nogo',
              'text-field': '{title}',
              'text-font': ['Open Sans Semibold', 'Arial Unicode MS Bold'],
              'text-offset': [0, 0.55],
              'text-anchor': 'bottom'
            }
          });
        });
      });
  };

  private mapToFeatures = (stations: Station[]) => {
    return stations.map(station => {
      return {
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [station.x, station.y]
        },
        properties: {
          title: station.bikesAvailable
        }
      };
    });
  };

  private subscribePosition() {
    this.subscription = this.coordinates
      .pipe(
        filter(value => !!value),
        tap(coordinates => {
          const { latitude, longitude } = coordinates;
          this.map.flyTo({ center: [longitude, latitude], zoom: 14 });
        })
      )
      .subscribe();
  }

  private buildMap = () => {
    this.map = new mapboxgl.Map({
      container: 'map',
      style: 'mapbox://styles/mapbox/outdoors-v10',
      zoom: 14,
      center: [24.9414377, 60.1718441]
    });

    this.map.on('load', () => {
      this.getAvailableMarkers();
      this.getUnavailableMarkers();
    });
  };

  ngOnDestroy() {
    if (this.subscription) {
      this.subscription.unsubscribe();
    }
  }
}
