/* globals AFRAME THREE */

var Particle = function (position, options) {
  this.variance = options['variance'] || 0.0;

  this.scatter = options['scatter'] || false;
  if (typeof this.scatter === 'number') this.scatter = [this.scatter, this.scatter, this.scatter];

  this.initialSpeed = options['speed'] || [0, 0, 0];
  if (typeof this.initialSpeed === 'number') this.initialSpeed = [this.speed, this.speed, this.speed];

  this.initialPosition = [position.x, position.y, position.z];
  this.initialSize = options['size'] || 0.1;

  this.alpha = 1.0;
  this.size = this.initialSize;
  this.life = 0;
  this.maxLife = this.totalLife = options['maxLife'] || false;

  this.init();
};
Particle.prototype.addVariance = function (parameter) {
  if (!this.variance) return;
  if (typeof this[parameter] === 'number') {
    this[parameter] += this[parameter] * (Math.random() * this.variance - this.variance * 0.5);
  }
  else {
    for (var i in this[parameter]) {
      this[parameter][i] += this[parameter][i] * (Math.random() * this.variance - this.variance * 0.5);
    }
  }
};
Particle.prototype.init = function () {
  this.x = this.initialPosition[0];
  this.y = this.initialPosition[1];
  this.z = this.initialPosition[2];
  if (this.scatter) {
    this.x += Math.random() * this.scatter[0] - this.scatter[0] / 2;
    this.y += Math.random() * this.scatter[1] - this.scatter[1] / 2;
    this.z += Math.random() * this.scatter[2] - this.scatter[2] / 2;
  } 
  this.speed = [this.initialSpeed[0], this.initialSpeed[1], this.initialSpeed[2]];
  this.alpha = 0.0;
  this.life = 0;
  this.maxLife = this.totalLife;
  this.size = this.initialSize;
  this.addVariance('speed');
  this.addVariance('alpha');
  this.addVariance('maxLife');
  this.addVariance('size');
  this.step(1);
};
Particle.prototype.step = function (delta) {
  this.life += delta;
  if (this.maxLife && this.life > this.maxLife) {
    this.init();
    return;
  }
  this.x += this.speed[0];
  this.y += this.speed[1];
  this.z += this.speed[2];
  if (this.life < this.maxLife * 0.1) {
    this.alpha = this.life / (this.maxLife * 0.1);
  }
  else if (this.life >= this.maxLife * 0.1) {
    this.alpha = 1.0 - (this.life - this.maxLife * 0.1) / (this.maxLife * 0.9);
  }
  // this.size = this.initialSize - this.life / this.maxLife * this.initialSize;
};

var particleBrush = {
  init: function (color, width) {
    this.material = new THREE.MeshStandardMaterial({
      color: this.data.color,
      roughness: 0.75,
      metalness: 0.25,
      side: THREE.DoubleSide,
      shading: THREE.FlatShading
    });
    this.idx3 = 0;
    this.idx = 0;
    this.geometry = new THREE.BufferGeometry();
    this.vertices = new Float32Array(this.options.maxPoints * 3);
    this.alphas = new Float32Array(this.options.maxPoints);
    this.sizes = new Float32Array(this.options.maxPoints);
    this.texture = null;

    this.geometry.setDrawRange(0, 0);
    this.geometry.addAttribute('position', new THREE.BufferAttribute(this.vertices, 3).setDynamic(true));
    this.geometry.addAttribute('size', new THREE.BufferAttribute(this.sizes, 1).setDynamic(true));
    this.geometry.addAttribute('alpha', new THREE.BufferAttribute(this.alphas, 1).setDynamic(true));

    var mesh = new THREE.Points(this.geometry, this.getMaterial());

    this.particles = [];

    this.object3D.add(mesh);
  },
  getMaterial: function () {
    var textureLoader = new THREE.TextureLoader();
    this.texture = textureLoader.load(this.materialOptions.textureSrc);

    this.uniforms = {
      color: { value: this.data.color },
      texture: { value: this.texture }
    };

    var vertexShader = '\
      attribute float size;\
      attribute float alpha;\
      \
      varying float vAlpha;\
      \
      void main() {\
          vAlpha = alpha;\
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);\
          gl_PointSize = size * (1000.0 / -mvPosition.z);\
          gl_Position = projectionMatrix * mvPosition;\
      }\
      ';
    var fragmentShader = '\
      uniform vec3 color;\
      uniform sampler2D texture;\
      varying float vAlpha;\
      void main() {\
        gl_FragColor = vec4(color, vAlpha) * texture2D(texture, gl_PointCoord);\
      }\
      ';

    return new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: vertexShader,
      fragmentShader: fragmentShader,
      depthTest: false,
      blending: this.materialOptions.blending === 'additive' ? THREE.AdditiveBlending : THREE.NormalBlending,
      transparent: true
    });
  },
  addPoint: function (position, rotation, pointerPosition, pressure, timestamp) {
    var particle = new Particle(pointerPosition, this.materialOptions);
    this.particles.push(particle);

    this.vertices[ this.idx3++ ] = particle.x;
    this.vertices[ this.idx3++ ] = particle.y;
    this.vertices[ this.idx3++ ] = particle.z;

    this.sizes[ this.idx ] = particle.size;
    this.alphas[ this.idx ] = particle.alpha;
    this.idx++;

    this.geometry.computeBoundingSphere();
    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.attributes.alpha.needsUpdate = true;
    this.geometry.attributes.size.needsUpdate = true;
    this.geometry.setDrawRange(0, this.data.numPoints);
    return true;
  },
  tick: function (time, delta) {
    var numParticles = this.particles.length;
    for (var i = 0, j = 0; i < numParticles; i++, j += 3) {
      var particle = this.particles[i];
      particle.step(delta);
      this.alphas[i] = particle.alpha;
      this.sizes[i] = particle.size;
      this.vertices[j + 0] = particle.x;
      this.vertices[j + 1] = particle.y;
      this.vertices[j + 2] = particle.z;
    }
    // this.geometry.computeBoundingSphere();
    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.attributes.alpha.needsUpdate = true;
    this.geometry.attributes.size.needsUpdate = true;
  }
};

var particleDefs = [
  {
    name: 'smoke',
    materialOptions: {
      size: 0.08,
      blending: 'additive',
      scatter: [0.06, 0.1, 0.06],
      speed: [0.0, 0.002, 0.0],
      maxLife: 3000,
      variance: 1.0,
      textureSrc: 'brushes/particle2.png'
    },
    thumbnail: 'brushes/particle2.png',
    spacing: 0.02,
    maxPoints: 3000
  },
  {
    name: 'stars',
    materialOptions: {
      size: 0.02,
      blending: 'additive',
      scatter: [0.1, 0.1, 0.1],
      speed: [0.0, -0.0001, 0.0],
      maxLife: 15000,
      variance: 1.0,
      textureSrc: 'brushes/particle1.png'
    },
    thumbnail: 'brushes/particle1.png',
    spacing: 0.03,
    maxPoints: 3000
  },
  {
    name: 'snow',
    materialOptions: {
      size: 0.01,
      blending: 'normal',
      scatter: [0.2, 0.2, 0.2],
      speed: [0, -0.001, 0.0001],
      maxLife: 5000,
      variance: 0.5,
      textureSrc: 'brushes/particle4.png'
    },
    thumbnail: 'brushes/particle4.png',
    spacing: 0.03,
    maxPoints: 3000
  }
];

for (var i = 0; i < particleDefs.length; i++) {
  var definition = particleDefs[i];
  AFRAME.registerBrush(
    definition.name,
    Object.assign({}, particleBrush, {materialOptions: definition.materialOptions}),
    {thumbnail: definition.thumbnail, spacing: definition['spacing'] || 0.01, maxPoints: definition.maxPoints});
}

/*
- spacing <s:float>
  A point must be separated by at least s meters to the previous one to be created
- size <s:float>
  Size of particles (in meters --affected by variance)
- blending <'normal'|'additive'>
- scatter [x:float, y:float, z:float]
  Scatter birth position of particles by a random amount of [x,y,z]
- speed [x:float, y:float, z:float]
  Initial particle speed (affected by variance)
- maxLife <ms:int>
  Maximum life of particle, in miliseconds. After that, particle is respawn.
  If maxLife is not defined or false, particles never respawns.
  (affected by variance)
- variance <v:float>
  Amount of randomness in some parameters.
  0: no random
  1: affects parameters by a random number up to the double of its initial value.
- textureSrc: <'path'>
  Texture of the particles
*/
