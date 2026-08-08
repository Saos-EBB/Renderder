import cube from "./cube.js";
import saos from "./saos.js";
import pyramid from "./pyramid.js";
import zyl from "./zyl.js";
import beetle from "./beetle.js";
import teapot from "./teapot.js";
import woody from "./woody.js";
import hand from "./hand.js";
import car from "./car.js";
import car01 from "./car01.js";
import skull from "./skull.js";
import ducky from "./ducky.js";
import shark from "./shark.js";
import dick from "./dick.js"
import dick01 from "./dick01.js"


const models = {
    cube: cube,
    saos: saos,
    pyramid: pyramid,
    zyl: zyl,
    beetle: beetle,
    teapot: teapot,
    woody: woody,
    hand: hand,
    car: car,
    car01: car01,
    ducky: ducky,
    skull: skull,
    shark: shark,
    dick : dick,
    dick01 : dick01
};

export function importModel(name) {

    if (!models[name]) {
        throw new Error(`Model :  ${name} not found`);
    }

    return models[name];
}