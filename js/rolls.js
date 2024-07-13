import * as THREE from "three";
// import fragment from "./shader/fragment.glsl";
// import vertex from "./shader/vertex.glsl";
import * as dat from "dat.gui";


const fragment=`uniform float time;
uniform float progress;
uniform sampler2D texture1;
uniform sampler2D texture2;
uniform vec4 resolution;

varying vec2 vUv;
varying float vFrontShadow;
// varying float vBackShadow;
// varying float vProgress;




void main()	{
	vec2 newUV = (vUv - vec2(0.5))*resolution.zw + vec2(0.5);

	gl_FragColor = texture2D(texture1,newUV);
    gl_FragColor.rgb *=vFrontShadow;
    gl_FragColor.a = clamp(progress*5.,0.,1.);

}` ;

const vertex=`uniform float time;
uniform float angle;
uniform float progress;
uniform vec4 resolution;
varying vec2 vUv;
varying float vFrontShadow;
// varying float vBackShadow;
// varying float vProgress;

uniform sampler2D texture1;
uniform sampler2D texture2;
uniform vec2 pixels;

const float pi = 3.1415925;

mat4 rotationMatrix(vec3 axis, float angle) {
    axis = normalize(axis);
    float s = sin(angle);
    float c = cos(angle);
    float oc = 1.0 - c;
    
    return mat4(oc * axis.x * axis.x + c,           oc * axis.x * axis.y - axis.z * s,  oc * axis.z * axis.x + axis.y * s,  0.0,
                oc * axis.x * axis.y + axis.z * s,  oc * axis.y * axis.y + c,           oc * axis.y * axis.z - axis.x * s,  0.0,
                oc * axis.z * axis.x - axis.y * s,  oc * axis.y * axis.z + axis.x * s,  oc * axis.z * axis.z + c,           0.0,
                0.0,                                0.0,                                0.0,                                1.0);
}
vec3 rotate(vec3 v, vec3 axis, float angle) {
  mat4 m = rotationMatrix(axis, angle);
  return (m * vec4(v, 1.0)).xyz;
}




void main() {
  vUv = uv;
  float pi = 3.14159265359;


  float finalAngle = angle - 0.*0.3*sin(progress*6.);

  // @todo account for aspect ratio!!!
  vec3 newposition = position;

  // float angle = pi/10.;
  float rad = 0.1;
  float rolls = 8.;
  // rot
  newposition = rotate(newposition - vec3(-.5,.5,0.), vec3(0.,0.,1.),-finalAngle) + vec3(-.5,.5,0.);

  float offs = (newposition.x + 0.5)/(sin(finalAngle) + cos(finalAngle)) ; // -0.5..0.5 -> 0..1
  float tProgress = clamp( (progress - offs*0.99)/0.01 , 0.,1.);

  // shadows
  vFrontShadow = clamp((progress - offs*0.95)/0.05,0.7,1.);
  // vBackShadow = 1. - clamp(abs((progress - offs*0.9)/0.1),0.,1.);
  // vProgress = clamp((progress - offs*0.95)/0.05,0.,1.);

  

  newposition.z =  rad + rad*(1. - offs/2.)*sin(-offs*rolls*pi - 0.5*pi);
  newposition.x =  - 0.5 + rad*(1. - offs/2.)*cos(-offs*rolls*pi + 0.5*pi);
  // // rot back
  newposition = rotate(newposition - vec3(-.5,.5,0.), vec3(0.,0.,1.),finalAngle) + vec3(-.5,.5,0.);
  // unroll
  newposition = rotate(newposition - vec3(-.5,0.5,rad), vec3(sin(finalAngle),cos(finalAngle),0.), -pi*progress*rolls);
  newposition +=  vec3(
    -.5 + progress*cos(finalAngle)*(sin(finalAngle) + cos(finalAngle)), 
    0.5 - progress*sin(finalAngle)*(sin(finalAngle) + cos(finalAngle)),
    rad*(1.-progress/2.)
  );

  // animation
  vec3 finalposition = mix(newposition,position,tProgress);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(finalposition, 1.0 );
}


` ;

export default class Sketch {
  constructor(selector) {
    this.scene = new THREE.Scene();

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true
    });
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setSize(this.width, this.height);
    this.renderer.sortObjects = false;

    this.renderer.outputEncoding = THREE.sRGBEncoding;

    this.container = document.getElementById("container");
    this.container.appendChild(this.renderer.domElement);

    this.camera = new THREE.PerspectiveCamera(
      70,
      window.innerWidth / window.innerHeight,
      300,
      1000
    );

    this.cameraDistance = 400;
    this.camera.position.set(0, 0, this.cameraDistance);
    this.camera.lookAt(0, 0, 0);
    this.time = 0;

    this.paused = false;

    this.settings();
    this.setupResize();

    this.addObjects();
    this.resize();
    this.render();
  }

  settings() {
    let that = this;
    this.settings = {
      progress: 0,
      angle: 0.25
    };
    // this.gui = new dat.GUI();
    // // this.gui.add(this.settings, "progress", -1, 2, 0.01);
    // this.gui.add(this.settings, "progress", 0, 1, 0.01);
    // this.gui.add(this.settings, "angle", 0, 3.1415, 0.01);
  }

  setupResize() {
    window.addEventListener("resize", this.resize.bind(this));
  }

  resize() {
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.renderer.setSize(this.width, this.height);
    this.camera.aspect = this.width / this.height;

    this.camera.fov =
      2 *
      Math.atan(this.width / this.camera.aspect / (2 * this.cameraDistance)) *
      (180 / Math.PI); // in degrees

    this.camera.updateProjectionMatrix();
  }

  addObjects() {
    let that = this;
    this.geometry = new THREE.PlaneBufferGeometry(1, 1, 80, 80);
    this.material = new THREE.ShaderMaterial({
      extensions: {
        derivatives: "#extension GL_OES_standard_derivatives : enable"
      },
      side: THREE.DoubleSide,
      uniforms: {
        time: { type: "f", value: 0 },
        progress: { type: "f", value: 0 },
        angle: { type: "f", value: 0 },
        texture1: { type: "t", value: null },
        texture2: { type: "t", value: null },
        resolution: { type: "v4", value: new THREE.Vector4() },
        uvRate1: {
          value: new THREE.Vector2(1, 1)
        }
      },
      // wireframe: true,
      transparent: true,
      vertexShader: vertex,
      fragmentShader: fragment
    });
  }

  createMesh(o) {
    let material = this.material.clone();
    let texture = new THREE.Texture(o.image);
    texture.needsUpdate = true;
    // image cover
    let imageAspect = o.iHeight / o.iWidth;
    let a1;
    let a2;
    if (o.height / o.width > imageAspect) {
      a1 = (o.width / o.height) * imageAspect;
      a2 = 1;
    } else {
      a1 = 1;
      a2 = o.height / o.width / imageAspect;
    }
    texture.minFilter = THREE.LinearFilter;
    material.uniforms.resolution.value.x = o.width;
    material.uniforms.resolution.value.y = o.height;
    material.uniforms.resolution.value.z = a1;
    material.uniforms.resolution.value.w = a2;
    material.uniforms.progress.value = 0;
    material.uniforms.angle.value = 0.3;

    material.uniforms.texture1.value = texture;
    material.uniforms.texture1.value.needsUpdate = true;

    let mesh = new THREE.Mesh(this.geometry, material);

    mesh.scale.set(o.width, o.height, o.width / 2);

    return mesh;
  }

  stop() {
    this.paused = true;
  }

  play() {
    this.paused = false;
    this.render();
  }

  render() {
    this.scene.children.forEach(m => {
      if (m.material.uniforms) {
        m.material.uniforms.angle.value = this.settings.angle;
      }
    });
    this.renderer.render(this.scene, this.camera);
  }
}
