import { HttpClient } from '@angular/common/http';
import { Component, OnDestroy, OnInit } from '@angular/core';
import * as mapboxgl from 'mapbox-gl';
import { BehaviorSubject, Observable, Subscription } from 'rxjs';
import {
  debounceTime,
  distinctUntilChanged,
  filter,
  map,
  shareReplay,
  switchMap,
  tap
} from 'rxjs/operators';
import { environment } from '../../environments/environment';

const zoom = 14.8;

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
  currentLocationId: string;
  availableLocationsId: string;
  unavailableLocationsId: string;
  subscription: Subscription;
  geolocation: Geolocation;
  coordinates = new BehaviorSubject<{ latitude: number; longitude: number }>(
    null
  );
  windowLoaded = new BehaviorSubject<number>(null);
  map: mapboxgl.Map;
  markersCache: Observable<Station[]>;

  constructor(private http: HttpClient) {
    Object.getOwnPropertyDescriptor(mapboxgl, 'accessToken').set(
      environment.mapboxApiKey
    );
  }

  ngOnInit() {
    this.geolocation = navigator.geolocation;
    this.buildMap();
    this.getCurrentLocation();
    this.onLoad();
  }

  private onLoad() {
    window.onload = window.onfocus = () => {
      const time = new Date().getTime();
      this.getCurrentLocation();
      this.windowLoaded.next(time);
    };
  }

  getCurrentLocation() {
    this.loading = true;
    if (this.geolocation) {
      this.geolocation.getCurrentPosition(position => {
        const { latitude, longitude } = position.coords;
        this.coordinates.next({ latitude, longitude });
        this.loading = false;
      });
    }
  }

  private requestMarkers = () => {
    return this.windowLoaded.pipe(
      distinctUntilChanged(),
      debounceTime(1000),
      switchMap(() => {
        return this.http.get<QueryResult>(
          'https://api.digitransit.fi/routing/v1/routers/hsl/bike_rental'
        );
      }),
      map(data => data.stations)
    );
  };

  private getMarkers = () => {
    if (!this.markersCache) {
      this.markersCache = this.requestMarkers().pipe(shareReplay());
    }
    return this.markersCache;
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
        this.setAvailableMarkers(features);
      });
  };

  private setAvailableMarkers = (features: any) => {
    const previousId = this.availableLocationsId;

    const time = new Date();
    this.availableLocationsId = time.toString() + 'available';

    this.map.addLayer({
      id: this.availableLocationsId,
      type: 'symbol',
      source: {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features
        }
      },
      layout: {
        'icon-image': 'yellow',
        'text-field': '{title}',
        'text-font': ['Open Sans Semibold', 'Arial Unicode MS Bold'],
        'text-offset': [0, 0.55],
        'text-anchor': 'bottom'
      }
    });

    const layer = this.map.getLayer(previousId);

    if (layer) {
      this.map.removeLayer(previousId);
    }
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
        this.setUnavailableMarkers(features);
      });
  };

  private setUnavailableMarkers = (features: any) => {
    const previousId = this.unavailableLocationsId;

    const time = new Date();
    this.unavailableLocationsId = time.toString() + 'unavailable';

    this.map.addLayer({
      id: this.unavailableLocationsId,
      type: 'symbol',
      source: {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features
        }
      },
      layout: {
        'icon-image': 'white',
        'text-field': '{title}',
        'text-font': ['Open Sans Semibold', 'Arial Unicode MS Bold'],
        'text-offset': [0, 0.55],
        'text-anchor': 'bottom'
      }
    });

    const layer = this.map.getLayer(previousId);

    if (layer) {
      this.map.removeLayer(previousId);
    }
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

  private subscribeCurrentLocation() {
    this.subscription = this.coordinates
      .pipe(
        distinctUntilChanged(),
        debounceTime(1000),
        filter(value => !!value),
        tap(coordinates => {
          const { latitude, longitude } = coordinates;

          const features = [
            {
              type: 'Feature',
              geometry: {
                type: 'Point',
                coordinates: [longitude, latitude]
              }
            }
          ] as any;

          this.setCurrentLocation(features);

          this.map.flyTo({ center: [longitude, latitude], zoom });
        })
      )
      .subscribe();
  }

  private setCurrentLocation = (features: any) => {
    const previousId = this.currentLocationId;

    const time = new Date();
    this.currentLocationId = time.toString() + 'current';

    this.map.addLayer({
      id: this.currentLocationId,
      type: 'symbol',
      source: {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features
        }
      },
      layout: {
        'icon-image': 'red'
      }
    });

    const layer = this.map.getLayer(previousId);

    if (layer) {
      this.map.removeLayer(previousId);
    }
  };

  private buildMap = () => {
    this.map = new mapboxgl.Map({
      container: 'map',
      style: 'mapbox://styles/mapbox/outdoors-v10',
      zoom,
      center: [24.9414377, 60.1718441]
    });

    this.map.on('load', () => {
      this.setRedMarker();
      this.setWhiteMarker();
      this.setYellowMarker();
      this.getAvailableMarkers();
      this.getUnavailableMarkers();
      this.subscribeCurrentLocation();
    });
  };

  private setRedMarker = () => {
    this.map.loadImage('assets/icons/red.png', (err, image) => {
      if (err) {
        console.error(err);
      }
      this.map.addImage('red', image);
    });
  };

  private setWhiteMarker = () => {
    this.map.loadImage('assets/icons/white.png', (err, image) => {
      if (err) {
        console.error(err);
      }
      this.map.addImage('white', image);
    });
  };

  private setYellowMarker = () => {
    this.map.loadImage('assets/icons/yellow.png', (err, image) => {
      if (err) {
        console.error(err);
      }
      this.map.addImage('yellow', image);
    });
  };

  ngOnDestroy() {
    if (this.subscription) {
      this.subscription.unsubscribe();
    }
  }
}
