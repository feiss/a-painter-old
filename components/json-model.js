AFRAME.registerComponent('json-model', {
  schema: {
    src: {type: 'src'},
  },
  init: function () {
    var objectLoader;
    var object3D = this.el.object3D;
    if (this.objectLoader) { return; }
    objectLoader = this.objectLoader = new THREE.ObjectLoader();
    objectLoader.load(this.data.src, function(group) {
      object3D.add(group);
    });
  }
});