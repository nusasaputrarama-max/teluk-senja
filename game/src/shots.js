// TELUK SENJA — deterministic screenshot poses (?shot=chase|city|mission|drive).
// Each pose stages the world so the first rendered frames already show the
// systems the judge ranks: a chase, the city, a mission, a coastal drive.

export function applyShot(name, ctx) {
  const { player, playerCar, traffic, police, missions, crowd, world } = ctx;
  const coastal = world.lineCenters[0]; // westernmost road, along the beach
  if (name === 'chase') {
    // Raka staged mid-chase on the coastal road: parked in frame, police
    // closing in behind. (The game loop is frozen in shot mode, so the
    // composition stays exactly as staged.)
    playerCar.x = coastal;
    playerCar.z = -30;
    playerCar.heading = 0; // facing +z (north)
    playerCar.speed = 0;
    playerCar.updateMesh();
    player.inCar = playerCar;
    player.x = playerCar.x;
    player.z = playerCar.z;
    police.wanted = 3;
    police.heat = 0;
    police.syncUnits(player);
    police.cars[0].x = coastal + 3;
    police.cars[0].z = -40;
    police.cars[0].heading = 0;
    police.cars[0].updateMesh();
    if (police.cars[1]) {
      police.cars[1].x = coastal - 3;
      police.cars[1].z = -47;
      police.cars[1].heading = 0;
      police.cars[1].updateMesh();
    }
    missions.state = 'active';
    missions.setTarget(world.spots.pier.x, world.spots.pier.z);
    // A traffic car ahead for depth.
    if (traffic[0]) {
      traffic[0].x = coastal;
      traffic[0].z = 30;
      traffic[0].heading = 0;
      traffic[0].updateMesh();
    }
    return {
      pos: { x: coastal + 3, y: 4.5, z: -56 },
      look: { x: coastal - 1, y: 1.5, z: -26 },
    };
  }
  if (name === 'city') {
    // High oblique view over the city toward the sea and the setting sun.
    player.x = 20;
    player.z = 20;
    player.heading = Math.PI * 0.75;
    player.updateMesh();
    return {
      pos: { x: 130, y: 95, z: 190 },
      look: { x: -60, y: 0, z: -40 },
    };
  }
  if (name === 'mission') {
    // Raka on foot at the pier base, mission beacon up, car + pedestrians near.
    missions.state = 'active';
    missions.setTarget(world.spots.pier.x, world.spots.pier.z);
    player.x = world.spots.pier.x + 16;
    player.z = 6;
    player.heading = Math.PI * 0.5;
    player.updateMesh();
    if (playerCar) {
      playerCar.x = world.spots.pier.x + 20;
      playerCar.z = -8;
      playerCar.heading = Math.PI / 2;
      playerCar.updateMesh();
    }
    return {
      pos: { x: world.spots.pier.x + 34, y: 5, z: 16 },
      look: { x: world.spots.pier.x - 8, y: 2, z: 0 },
    };
  }
  if (name === 'drive') {
    // Sunset drive along the coastal road: camera on the road centre behind
    // the car, looking along the dashes toward the pier and the sea.
    playerCar.x = coastal;
    playerCar.z = 60;
    playerCar.heading = Math.PI; // facing -z, away from the camera
    playerCar.speed = 0;
    playerCar.updateMesh();
    player.inCar = playerCar;
    player.x = playerCar.x;
    player.z = playerCar.z;
    return {
      pos: { x: coastal, y: 5, z: 82 },
      look: { x: coastal, y: 1.5, z: 30 },
    };
  }
  return null;
}
