import React, { useState, useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import * as THREE from 'three';
import { ThreeLayer } from '../utils/ThreeLayer';
import "mapbox-gl/dist/mapbox-gl.css";
import "../styles/map.css";

const MAPBOX_TOKEN = "pk.eyJ1IjoidGhlb2RvcmVob2ZmbWFuIiwiYSI6ImNtY2FhdXo5MjAxZnkyaXM1cHYwN2V2b2QifQ.y8-4p4HHdrTQBbetYXq2Zg";
mapboxgl.accessToken = MAPBOX_TOKEN;

const OFFICE_COORDS = [8.658457484750747, 49.34237108123256];

const MapAnimation = () => {
    const mapContainer = useRef(null);
    const mapInstance = useRef(null);
    const [isLoading, setIsLoading] = useState(true);
    const isMounted = useRef(true);

    useEffect(() => {
        isMounted.current = true;
        if (!mapContainer.current || mapInstance.current) return;

        console.log("MapAnimation: Component mounting, starting init...");

        // Safety fallback: Clear loading screen after 6 seconds
        const fallback = setTimeout(() => {
            if (isMounted.current) setIsLoading(false);
        }, 6000);

        try {
            const m = new mapboxgl.Map({
                container: mapContainer.current,
                style: 'mapbox://styles/mapbox/satellite-streets-v12',
                center: [0, 20],
                zoom: 1.5,
                projection: 'globe',
                interactive: false,
                antialias: true
            });

            mapInstance.current = m;

            m.on('load', () => {
                console.log("MapAnimation: Map loaded event.");
                if (isMounted.current) {
                    setIsLoading(false);
                    startCinematic(m);
                }
            });

            m.on('style.load', () => {
                console.log("MapAnimation: Style loaded event.");
                setupEnvironment(m);
            });

            m.on('error', (e) => {
                console.error("MapAnimation: Mapbox internal error", e);
                if (isMounted.current) setIsLoading(false);
            });

        } catch (err) {
            console.error("MapAnimation: Critical Init Exception", err);
            if (isMounted.current) setIsLoading(false);
        }

        const setupEnvironment = (m) => {
            try {
                // 1. Terrain & Digital Grid
                m.addSource('mapbox-dem', { 'type': 'raster-dem', 'url': 'mapbox://mapbox.mapbox-terrain-dem-v1', 'tileSize': 512 });
                m.setTerrain({ 'source': 'mapbox-dem', 'exaggeration': 1.1 });
                m.setFog({ color: "rgba(255, 255, 255, 0)", "star-intensity": 1.0 });

                // 2. High-Fidelity 3D Layer
                const layer3d = new ThreeLayer('hq-3d-office', OFFICE_COORDS);
                layer3d.setupScene = function() {
                    const ambient = new THREE.AmbientLight(0xffffff, 0.8);
                    const sun = new THREE.DirectionalLight(0xffffff, 1.5);
                    sun.position.set(40, 100, 30);
                    this.scene.add(ambient, sun);

                    const model = new THREE.Group();
                    
                    // Main Body
                    const body = new THREE.Mesh(
                        new THREE.BoxGeometry(22, 10, 14), 
                        new THREE.MeshStandardMaterial({ color: '#f8fafc', roughness: 0.8 })
                    );
                    body.position.y = 5;
                    model.add(body);

                    // Gabled Roof
                    const roofShape = new THREE.Shape();
                    roofShape.moveTo(-11.5, 0); 
                    roofShape.lineTo(0, 7); 
                    roofShape.lineTo(11.5, 0);
                    const roofGeo = new THREE.ExtrudeGeometry(roofShape, { depth: 15, bevelEnabled: false });
                    const roof = new THREE.Mesh(roofGeo, new THREE.MeshStandardMaterial({ color: '#1e293b', roughness: 0.9 }));
                    roof.rotation.y = Math.PI / 2;
                    roof.position.set(0, 10, 7.5);
                    model.add(roof);

                    // Windows
                    const glassMat = new THREE.MeshStandardMaterial({ color: '#bae6fd', metalness: 1.0, roughness: 0.1, transparent: true, opacity: 0.8 });
                    const winGeo = new THREE.BoxGeometry(2.2, 3.2, 0.2);
                    for (let i = -8; i <= 8; i += 4) {
                        const win = new THREE.Mesh(winGeo, glassMat);
                        win.position.set(i, 5, 7.1);
                        model.add(win.clone());
                    }

                    this.scene.add(model);
                };
                m.addLayer(layer3d);

                // 3. Location Marker
                const el = document.createElement('div');
                el.className = 'location-marker';
                el.innerHTML = '<div class="marker-dot"></div><div class="marker-pulse"></div>';
                new mapboxgl.Marker(el).setLngLat(OFFICE_COORDS).addTo(m);

            } catch (err) {
                console.error("MapAnimation: Environment setup failed", err);
            }
        };

        const startCinematic = async (m) => {
            console.log("MapAnimation: Starting sequence...");
            // Spin
            await new Promise(r => {
                let s = null;
                const f = (t) => {
                    if (!s) s = t;
                    const elapsed = t - s;
                    if (elapsed < 2500 && isMounted.current) {
                        m.setBearing((elapsed / 2500) * 12);
                        requestAnimationFrame(f);
                    } else r();
                };
                requestAnimationFrame(f);
            });

            // Zoom Sequence
            const stages = [
                { center: [8.65, 49.34], zoom: 10, duration: 4000 },
                { center: OFFICE_COORDS, zoom: 17.5, pitch: 55, bearing: 15, duration: 5000 }
            ];

            for (const stage of stages) {
                if (!isMounted.current) break;
                await new Promise(resolve => {
                    m.easeTo({ ...stage, essential: true, easing: t => t * (2 - t) });
                    m.once('moveend', resolve);
                });
            }

            // End State: Unlock Controls
            if (isMounted.current) {
                console.log("MapAnimation: Sequence finished, unlocking.");
                m.getCanvas().style.cursor = "grab";
                ['dragPan', 'dragRotate', 'scrollZoom', 'touchZoomRotate', 'doubleClickZoom'].forEach(h => {
                    if (m[h]) m[h].enable();
                });
            }
        };

        return () => {
            console.log("MapAnimation: Unmounting, cleaning up...");
            isMounted.current = false;
            clearTimeout(fallback);
            if (mapInstance.current) {
                mapInstance.current.remove();
                mapInstance.current = null;
            }
        };
    }, []);

    return (
        <div className="app-viewport">
            {isLoading && (
                <div className="loading-overlay">
                    <div className="pulse-loader"></div>
                    <h1>Synchronizing...</h1>
                </div>
            )}
            <div ref={mapContainer} className="map-container" />
        </div>
    );
};

export default MapAnimation;
