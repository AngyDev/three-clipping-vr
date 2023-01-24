# Clipping in VR

This code implements clipping in a virtual reality scene using the Three.js library. It includes classes, methods, and examples that are useful for creating and manipulating clipping planes, or for adjusting the visibility of objects in a Three.js VR scene based on the position of the user's head-mounted display. The function used in the project [threejs-clipping](https://github.com/AngyDev/threejs-clipping) is not used because when this function is applied to this case the colored clipping planes are not visible in the correct space, they are translated, I wasn't able to figure out why.

## Demo

https://clipping-vr.netlify.app/

<img align="left" src="./img/start.png" width="400"/>
<img src="./img/clipping.png" width="400"/>

## Functionalities

- Import an STL file
- Add planes
- Hide planes
- Clipping
- Nagate clipping
- Join mesh, with this function is possible to move all the objects in the scene together
- Scale the selected object
- With the controller is possible to move the object in the scene

## Setup

If you want to start the application in local:

1. Clone the project `git clone git@github.com:AngyDev/three-clipping-vr.git`
2. With your terminal go in the folder where you cloned the project
3. Run the command `npm install` to install the dependencies
4. Run the command `npm run start` to run the project
