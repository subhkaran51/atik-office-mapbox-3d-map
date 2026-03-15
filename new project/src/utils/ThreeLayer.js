import * as THREE from 'three';
import mapboxgl from 'mapbox-gl';

/**
 * ThreeLayer utility for Mapbox GL JS integration
 */
export class ThreeLayer {
    constructor(id, coords) {
        this.id = id;
        this.type = 'custom';
        this.renderingMode = '3d';
        this.coords = coords;
        this.camera = new THREE.Camera();
        this.scene = new THREE.Scene();
    }

    onAdd(map, gl) {
        const center = mapboxgl.MercatorCoordinate.fromLngLat(this.coords, 0);
        this.modelTransform = {
            translateX: center.x,
            translateY: center.y,
            translateZ: center.z,
            rotateX: Math.PI / 2,
            rotateY: 0,
            rotateZ: 0,
            scale: center.meterInMercatorCoordinateUnits()
        };

        this.renderer = new THREE.WebGLRenderer({
            canvas: map.getCanvas(),
            context: gl,
            antialias: true
        });

        this.renderer.autoClear = false;
        this.renderer.shadowMap.enabled = true;
        this.setupScene();
    }

    onRemove() {
        if (this.renderer) this.renderer.dispose();
        if (this.scene) this.scene.clear();
    }

    setupScene() {} // Overridden in component

    render(gl, matrix) {
        if (!this.modelTransform) return;
        
        const m = new THREE.Matrix4().fromArray(matrix);
        const l = new THREE.Matrix4()
            .makeTranslation(this.modelTransform.translateX, this.modelTransform.translateY, this.modelTransform.translateZ)
            .scale(new THREE.Vector3(this.modelTransform.scale, -this.modelTransform.scale, this.modelTransform.scale))
            .multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2));

        this.camera.projectionMatrix = m.multiply(l);
        this.renderer.resetState();
        this.renderer.render(this.scene, this.camera);
    }
}
