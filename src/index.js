import './index.css'

import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { VRButton } from 'three/addons/webxr/VRButton.js'
import { XRControllerModelFactory } from 'three/addons/webxr/XRControllerModelFactory.js'
import { STLLoader } from 'three/addons/loaders/STLLoader.js'
import { TransformControls } from 'three/addons/controls/TransformControls.js'
import { GUI } from 'three/addons/libs/lil-gui.module.min.js'
import { HTMLMesh } from 'three/addons/interactive/HTMLMesh.js'
import { InteractiveGroup } from 'three/addons/interactive/InteractiveGroup.js'

let container
let camera, scene, renderer
let controller1, controller2
let controllerGrip1, controllerGrip2

let raycaster

let baseReferenceSpace

const intersected = []
const tempMatrix = new THREE.Matrix4()

let controls, tControls, group, groupFiles

let planeMesh, planeMesh2

let planes = []
let planesOriginal = []

const pointer = new THREE.Vector2()

const params = {
  clipping: 0,
  negated: 0,
  addPlane: () => createPlane(),
  hidePlanes: 0,
}

init()
animate()

function init() {
  container = document.createElement('div')
  document.body.appendChild(container)

  scene = new THREE.Scene()
  scene.background = new THREE.Color(0x808080)

  // camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 1, 10000)
  // camera.position.set(0, -200, 100)

  camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 10)
  camera.position.set(0, 1.6, 3)

  controls = new OrbitControls(camera, container)
  controls.target.set(0, 1.6, 0)
  controls.update()

  const floorGeometry = new THREE.PlaneGeometry(4, 4)
  const floorMaterial = new THREE.MeshStandardMaterial({
    color: 0xeeeeee,
    roughness: 1.0,
    metalness: 0.0,
  })
  const floor = new THREE.Mesh(floorGeometry, floorMaterial)
  floor.rotation.x = -Math.PI / 2
  floor.receiveShadow = true
  scene.add(floor)

  scene.add(new THREE.AmbientLight(0xffffff, 0.5))

  // const light = new THREE.DirectionalLight(0xffffff);
  // light.position.set(0, 6, 0);
  // light.castShadow = true;
  // light.shadow.camera.top = 2;
  // light.shadow.camera.bottom = -2;
  // light.shadow.camera.right = 2;
  // light.shadow.camera.left = -2;
  // light.shadow.mapSize.set(4096, 4096);
  // scene.add(light);

  const directionalLight = new THREE.DirectionalLight(0xffffff)
  directionalLight.position.copy(camera.position)
  directionalLight.castShadow = true
  scene.add(directionalLight)

  // container.addEventListener('click', function (event) {
  //   const plane = scene && scene.children.find((item) => item.name === 'plane')

  //   pointer.x = (event.clientX / window.innerWidth) * 2 - 1
  //   pointer.y = -(event.clientY / window.innerHeight) * 2 + 1
  //   raycaster.setFromCamera(pointer, camera)

  //   if (plane) {
  //     const intersections = raycaster.intersectObject(plane, false)

  //     if (intersections.length === 0) {
  //       tControls.visible = false
  //     } else {
  //       tControls.visible = true
  //     }
  //   }
  // })

  group = new THREE.Group()
  group.name = 'objects'
  scene.add(group)

  groupFiles = new THREE.Group()
  groupFiles.name = 'imported'
  // scene.add(groupFiles)

  // Renderer

  renderer = new THREE.WebGLRenderer({ antialias: true })
  renderer.setPixelRatio(window.devicePixelRatio)
  renderer.setSize(window.innerWidth, window.innerHeight)
  renderer.outputEncoding = THREE.sRGBEncoding
  renderer.shadowMap.enabled = true
  renderer.localClippingEnabled = true
  renderer.xr.enabled = true
  container.appendChild(renderer.domElement)

  document.body.appendChild(VRButton.createButton(renderer))

  tControls = new TransformControls(camera, renderer.domElement)
  tControls.addEventListener('change', render)

  tControls.addEventListener('dragging-changed', function (event) {
    controls.enabled = !event.value
  })

  scene.add(tControls)

  // GUI
  const gui = new GUI()
  gui.add(params, 'clipping', 0, 1, 1).onChange(() => {
    clippingObj()
  })

  gui.add(params, 'negated', 0, 1, 1).onChange(() => {
    negatedClipping()
  })

  gui.add(params, 'addPlane')
  gui.add(params, 'hidePlanes', 0, 1, 1).onChange(() => {
    const planesGeometry = group.children.filter((object) => object.name.startsWith('plane'))

    planesGeometry.forEach((item) => (item.visible = !item.visible))
  })
  gui.domElement.style.visibility = 'hidden'

  let groupGui = new InteractiveGroup(renderer, camera)
  scene.add(groupGui)

  const mesh = new HTMLMesh(gui.domElement)
  mesh.position.x = -0.75
  mesh.position.y = 1.5
  mesh.position.z = -0.5
  mesh.rotation.y = Math.PI / 4
  mesh.scale.setScalar(2)
  groupGui.add(mesh)

  // controllers

  const geometry = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -1)])
  const line = new THREE.Line(geometry)

  controller1 = renderer.xr.getController(0)
  controller1.addEventListener('selectstart', onSelectStart)
  controller1.addEventListener('selectend', onSelectEnd)
  scene.add(controller1)

  controller2 = renderer.xr.getController(1)
  // controller2.addEventListener('selectstart', onSelectStart)
  // controller2.addEventListener('selectend', onSelectEnd)
  scene.add(controller2)

  const controllerModelFactory = new XRControllerModelFactory()

  controllerGrip1 = renderer.xr.getControllerGrip(0)
  controllerGrip1.add(controllerModelFactory.createControllerModel(controllerGrip1))
  scene.add(controllerGrip1)

  controllerGrip2 = renderer.xr.getControllerGrip(1)
  controllerGrip2.add(controllerModelFactory.createControllerModel(controllerGrip2))
  scene.add(controllerGrip2)

  //

  line.name = 'line'
  line.scale.z = 5

  controller1.add(line.clone())
  controller2.add(line.clone())

  raycaster = new THREE.Raycaster()

  //

  window.addEventListener('resize', onWindowResize)
}

let mesh, position

// Load the file and get the geometry
document.getElementById('file').onchange = (e) => {
  const files = e.target.files

  if (files.length > 0) {
    for (var i = 0; i < files.length; i++) {
      loadFile(files[i])
    }
  }
}

const loadFile = (file) => {
  let reader = new FileReader()

  reader.onload = () => {
    const geometry = new STLLoader().parse(reader.result)

    createMeshFromFile(geometry)
  }

  reader.readAsArrayBuffer(file)
}

/**
 * Creates the mesh from the file's geometry
 * @param {THREE.BufferGeometry} geometry
 */
const createMeshFromFile = (geometry) => {
  if (mesh) {
    scene.remove(mesh)
  }

  const material = new THREE.MeshLambertMaterial({
    color: '#C7AC96',
    wireframe: false,
  })
  mesh = new THREE.Mesh(geometry, material)

  // saves the position of the first element
  if (!position) {
    position = getCenter(mesh)
  }

  // mesh.position.x = Math.random() * 4 - 2
  // mesh.position.y = Math.random() * 2
  // mesh.position.z = Math.random() * 4 - 2

  mesh.position.set(1, 1, -1)

  // mesh.position.set(-position.x, -position.y, -position.z)
  // mesh.scale.setScalar(Math.random() + 0.5)
  // mesh.scale.set(0.5, 0.5, 0.5)

  group.add(mesh)
  groupFiles.add(mesh.clone())
}

// document.getElementById('addPlanes').addEventListener('click', () => {
//   createPlane()
// })

const createPlane = () => {
  const geometry = new THREE.PlaneGeometry(2, 2, 1, 1)
  const material = new THREE.MeshStandardMaterial({
    color: '#38382f',
    side: THREE.DoubleSide,
  })
  const mesh = new THREE.Mesh(geometry, material)
  mesh.name = 'plane'

  mesh.position.set(1, 1, -1)

  group.add(mesh)

  // tControls.attach(mesh)
  // tControls.setMode('rotate')
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()

  renderer.setSize(window.innerWidth, window.innerHeight)
}

function onSelectStart(event) {
  const controller = event.target

  const intersections = getIntersections(controller)

  if (intersections.length > 0) {
    const intersection = intersections[0]

    const object = intersection.object
    object.material.emissive.b = 1
    controller.attach(object)

    controller.userData.selected = object
  }
}

function onSelectEnd(event) {
  const controller = event.target

  console.log(group);

  if (controller.userData.selected !== undefined) {
    const object = controller.userData.selected
    object.material.emissive.b = 0
    group.attach(object)

    controller.userData.selected = undefined
  }
}

function getIntersections(controller) {
  tempMatrix.identity().extractRotation(controller.matrixWorld)

  raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld)
  raycaster.ray.direction.set(0, 0, -1).applyMatrix4(tempMatrix)

  return raycaster.intersectObjects(group.children, false)
}

function intersectObjects(controller) {
  // Do not highlight when already selected

  if (controller.userData.selected !== undefined) return

  const line = controller.getObjectByName('line')
  const intersections = getIntersections(controller)

  if (intersections.length > 0) {
    const intersection = intersections[0]

    const object = intersection.object
    object.material.emissive.r = 1
    intersected.push(object)

    line.scale.z = intersection.distance
  } else {
    line.scale.z = 5
  }
}

function cleanIntersected() {
  while (intersected.length) {
    const object = intersected.pop()
    object.material.emissive.r = 0
  }
}

//

function animate() {
  renderer.setAnimationLoop(render)
}

function render() {
  cleanIntersected()

  intersectObjects(controller1)
  // intersectObjects(controller2)

  renderer.render(scene, camera)
}

// const negated = document.getElementById('negated')
// const negatedBox = document.getElementById('negatedBox')

// document.getElementById('clipping').addEventListener('click', () => {
//   clippingObj()
// })

const clippingObj = () => {
  planes = []
  planesOriginal = []
  const result = scene.children.filter((object) => object.name.startsWith('Clipping'))

  if (result.length === 0) {
    // negatedBox.style.display = 'unset'
    const planesGeometry = group.children.filter((object) => object.name.startsWith('plane'))
    const normals = []
    const centers = []

    planesGeometry.forEach((item) => {
      const plane = new THREE.Plane()
      const normal = new THREE.Vector3()
      const point = new THREE.Vector3()

      // Gets the centers of the planes
      const center = getCenterPoint(item)
      centers.push(center)

      // Creates the THREE.Plane from THREE.PlaneGeometry
      normal.set(0, 0, 1).applyQuaternion(item.quaternion)
      point.copy(item.position)
      plane.setFromNormalAndCoplanarPoint(normal, point)

      // Saves the normals of the planes
      normals.push(plane.normal)

      planes.push(plane)
    })

    // Calculates the barycenter of the planes
    const pointx = centers.reduce((prev, curr) => prev + curr.x, 0) / centers.length
    const pointy = centers.reduce((prev, curr) => prev + curr.y, 0) / centers.length
    const pointz = centers.reduce((prev, curr) => prev + curr.z, 0) / centers.length
    const barycenter = new THREE.Vector3(pointx, pointy, pointz)

    const distances = []

    // Gets the distance from the plane and the barycenter
    planes.forEach((item) => {
      distances.push(item.distanceToPoint(barycenter))
    })

    // Negates only the plane with negative distance
    distances.forEach((distance, index) => {
      if (distance < 0) {
        planes[index].negate()
      }
    })

    // Creates the clipping object with colors
    addColorToClippedMesh(scene, groupFiles, planes, planes, false)

    groupFiles.children.map((object) => {
      object.material.clipIntersection = false
    })

    // const planesOriginal = [];
    planesOriginal = planes.map((item) => item.clone())
  } else {
    // negatedBox.style.display = 'none'
    scene.children
      .filter((object) => object.name.startsWith('Clipping'))
      .map((object) => {
        scene.remove(object)
      })

    groupFiles.children.map((mesh) => {
      mesh.material.clippingPlanes = []
    })
  }
}

let count = 0

// negated.addEventListener('click', () => {
//   negatedClipping()
// })

const negatedClipping = () => {
  count++

  const result = scene.children.filter((object) => object.name.startsWith('Clipping'))

  if (result.length > 0) {
    // removes the previous clipping object
    scene.children
      .filter((object) => object.name.startsWith('Clipping'))
      .map((object) => {
        scene.remove(object)
      })
  }

  if (count % 2 != 0) {
    planes.forEach((item) => item.negate())
    // removes the previous clipping planes with negated planes for the mesh and original planes for the colored planes
    addColorToClippedMesh(scene, groupFiles, planes, planesOriginal, true)

    groupFiles.children.map((object) => {
      object.material.clipIntersection = true
    })
  } else {
    planes.forEach((item) => item.negate())

    // removes the previous clipping planes with negated planes for the mesh and original planes for the colored planes
    addColorToClippedMesh(scene, groupFiles, planesOriginal, planesOriginal, false)

    groupFiles.children.map((object) => {
      object.material.clipIntersection = false
    })
  }
}

// document.getElementById('hidePlane').addEventListener('click', () => {
//   const planesGeometry = scene.children.filter((object) => object.name.startsWith('plane'))

//   planesGeometry.forEach((item) => (item.visible = !item.visible))
// })

/**
 * Creates a clipping object
 * @param {THREE.BufferGeometry} geometry The geometry of the mesh
 * @param {THREE.Plane} plane The plane to clip the mesh
 * @param {THREE.Vector3} positionVector The vector to position the mesh
 * @param {Number} renderOrder The render order of the mesh
 * @returns THREE.Group of meshes
 */
export const createPlaneStencilGroup = (name, position, geometry, plane, renderOrder) => {
  const group = new THREE.Group()
  const baseMat = new THREE.MeshBasicMaterial()
  baseMat.depthWrite = false
  baseMat.depthTest = false
  baseMat.colorWrite = false
  baseMat.stencilWrite = true
  baseMat.stencilFunc = THREE.AlwaysStencilFunc

  // back faces
  const mat0 = baseMat.clone()
  mat0.side = THREE.BackSide
  mat0.clippingPlanes = [plane]
  mat0.stencilFail = THREE.IncrementWrapStencilOp
  mat0.stencilZFail = THREE.IncrementWrapStencilOp
  mat0.stencilZPass = THREE.IncrementWrapStencilOp

  const mesh0 = new THREE.Mesh(geometry, mat0)
  mesh0.name = 'back'
  mesh0.renderOrder = renderOrder
  mesh0.position.set(position.x, position.y, position.z)

  group.add(mesh0)

  // front faces
  const mat1 = baseMat.clone()
  mat1.side = THREE.FrontSide
  mat1.clippingPlanes = [plane]
  mat1.stencilFail = THREE.DecrementWrapStencilOp
  mat1.stencilZFail = THREE.DecrementWrapStencilOp
  mat1.stencilZPass = THREE.DecrementWrapStencilOp

  const mesh1 = new THREE.Mesh(geometry, mat1)
  mesh1.name = 'front'
  mesh1.renderOrder = renderOrder
  mesh1.position.set(position.x, position.y, position.z)

  group.add(mesh1)
  group.name = 'planeStencilGroup' + name

  return group
}

/**
 * Adds the color to the clipped mesh
 * @param {THREE.Scene} scene The scene to add the mesh to
 * @param {THREE.Group} group The group to add the mesh to
 * @param {THREE.Vector} positionVector The vector to position the mesh
 * @param {THREE.Plane} planesNegated The list of the negated planes
 * @param {THREE.Plane} planes The list of the planes
 */
export const addColorToClippedMesh = (scene, group, planesNegated, planes, negatedClick) => {
  let object = new THREE.Group()
  object.name = 'ClippingGroup'
  scene.add(object)

  let y = 0

  group.children.map((mesh) => {
    for (let i = 0; i < planesNegated.length; i++) {
      const planeObj = planesNegated[i]
      const stencilGroup = createPlaneStencilGroup(mesh.name, mesh.position, mesh.geometry, planeObj, y)

      object.add(stencilGroup)

      const cap = createPlaneColored(planes, planeObj, mesh.material.color, y + 0.1, negatedClick)
      cap.name = 'Clipping' + mesh.name
      scene.add(cap)

      planeObj.coplanarPoint(cap.position)
      cap.lookAt(cap.position.x - planeObj.normal.x, cap.position.y - planeObj.normal.y, cap.position.z - planeObj.normal.z)
      y++
    }

    mesh.material.clippingPlanes = planesNegated
  })
}

const createPlaneColored = (planes, plane, color, renderOrder, negatedClick) => {
  const capMat = new THREE.MeshStandardMaterial({
    color: color,
    metalness: 0.1,
    roughness: 0.75,
    clippingPlanes: planes.filter((p) => p !== plane),
    clipIntersection: negatedClick,
    side: THREE.DoubleSide,
    stencilWrite: true,
    stencilRef: 0,
    stencilFunc: THREE.NotEqualStencilFunc,
    stencilFail: THREE.ReplaceStencilOp,
    stencilZFail: THREE.ReplaceStencilOp,
    stencilZPass: THREE.ReplaceStencilOp,
  })
  const cap = new THREE.Mesh(new THREE.PlaneGeometry(2000, 2000), capMat)
  // clear the stencil buffer
  cap.onAfterRender = function (renderer) {
    renderer.clearStencil()
  }

  cap.renderOrder = renderOrder
  return cap
}

const getCenterPoint = (mesh) => {
  var geometry = mesh.geometry
  geometry.computeBoundingBox()
  var center = new THREE.Vector3()
  geometry.boundingBox.getCenter(center)
  mesh.localToWorld(center)
  return center
}

const getCenter = (object) => {
  const center = new THREE.Vector3()

  const box3 = new THREE.Box3().setFromObject(object)
  box3.getCenter(center)

  return center
}
