class Vector {
    constructor(x, y, z) {
        this.x = x;
        this.y = y;
        this.z = z;
    }

    clone() {
        return new Vector(this.x, this.y, this.z);
    }

    norm() {
        return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z);
    }

    normalized() {
        var length = this.norm();
        return new Vector(this.x / length, this.y / length, this.z / length);
    }

    add(other) {
        return new Vector(this.x + other.x, this.y + other.y, this.z + other.z);
    }

    sub(other) {
        return new Vector(this.x - other.x, this.y - other.y, this.z - other.z);
    }

    mul(scalar) {
        return new Vector(this.x * scalar, this.y * scalar, this.z * scalar);
    }

    div(scalar) {
        return new Vector(this.x / scalar, this.y / scalar, this.z / scalar);
    }

    compProduct(other) {
        return new Vector(this.x * other.x, this.y * other.y, this.z * other.z);
    }

    dotProduct(other) {
        return this.x * other.x + this.y * other.y + this.z * other.z;
    }
}

class Ray {
    constructor(origin, direction) {
        this.origin = origin;
        this.direction = direction.normalized();
    }

    clone() {
        return new Ray(this.origin.clone(), this.direction.clone());
    }
}


class PerspectiveCamera {
    constructor(focalLength=50, sensorWidth=32, sensorHeight=18) {
        this.focalLength = focalLength;
        this.sensorWidth = sensorWidth;
        this.sensorHeight = sensorHeight;
    }

    project(x, y) {
        return new Ray(new Vector(0, 0, 0), new Vector((x - 0.5) * this.sensorWidth, -(y - 0.5) * this.sensorHeight, -this.focalLength));
    }
}


class Film {
    constructor(width, height) {
        this.width = parseInt(width);
        this.height = parseInt(height);
    }

    trigger(camera, scene, numSamples) {
        var img = new Array(this.width).fill(0).map(()=>new Array(this.height));

        for(var x = 0; x < this.width; x++) {
            for(var y = 0; y < this.height; y++) {
                var colorSum = new Vector(0, 0, 0);
                for(var sample = 0; sample < numSamples; sample++) {
                    var color = scene.project(camera.project((x + Math.random()) / this.width, (y + Math.random()) / this.height));
                    colorSum = colorSum.add(color);
                }

                var colorAvg = colorSum.div(numSamples);
                img[x][y] = colorAvg;
            }
        }

        return img;
    }
}

class Background {
    project(ray) {
        var dir = ray.direction;
        if(dir.y < 0) {
            return new Vector(0.1, 0.4, 0.1);
        }
        else {
            return new Vector(dir.y * 2, dir.y * 4, 1.0);
        }
    }
}

class DistanceShaderPair {
    constructor(distance, shader) {
        this.distance = distance;
        this.shader = shader;
    }
}

class RayMarcher {
    constructor(sdf, background, backgroundDistance = 1000.0) {
        this.sdf = sdf;
        this.background = background;
        this.backgroundDistance = backgroundDistance
    }

    project(ray) {
        var r = ray.clone();
        var ds = this.sdf(r.origin);

        while(Math.abs(ds.distance) > 0.00000001) {
            r.origin = r.origin.add(r.direction.mul(ds.distance));
            ds = this.sdf(r.origin);

            if(r.origin.norm() >= this.backgroundDistance) {
                return this.background.project(r);
            }
        }

        return ds.shader.shade(r, this);
    }

    sampleDirectionalLight() {
        return [new Vector(-1, 1, 1).normalized(), new Vector(1, 1, 1)];
    }

    normal(p) {
        var x = this.sdf(new Vector(p.x + 0.001, p.y, p.z)).distance - this.sdf(new Vector(p.x - 0.001, p.y, p.z)).distance;
        var y = this.sdf(new Vector(p.x, p.y + 0.001, p.z)).distance - this.sdf(new Vector(p.x, p.y - 0.001, p.z)).distance;
        var z = this.sdf(new Vector(p.x, p.y, p.z + 0.001)).distance - this.sdf(new Vector(p.x, p.y, p.z - 0.001)).distance;

        return new Vector(x, y, z).normalized();
    }
}

//SDFs
function Sphere(radius, shader) {
    return function(p) {
        return new DistanceShaderPair(p.norm() - radius, shader);
    }
}

function YPlane(y, shader) {
    return function(p) {
        return new DistanceShaderPair(p.y - y, shader);
    }
}

function Cube(edgeLength, shader) {
    return function(p) {
        let dx = Math.abs(p.x) - edgeLength / 2;
        let dy = Math.abs(p.y) - edgeLength / 2;
        let dz = Math.abs(p.z) - edgeLength / 2;

        let inner = Math.min(0, Math.max(dx, dy, dz));

        let dx0 = Math.max(dx, 0);
        let dy0 = Math.max(dy, 0);
        let dz0 = Math.max(dz, 0);
        let outer = Math.sqrt(dx0 * dx0 + dy0 * dy0 + dz0 * dz0);
        
        let distance = inner + outer;

        return new DistanceShaderPair(distance, shader);
    }
}

function Rect(xLength, yLength, zLength, shader) {
    return function(p) {
        let dx = Math.abs(p.x) - xLength / 2;
        let dy = Math.abs(p.y) - yLength / 2;
        let dz = Math.abs(p.z) - zLength / 2;

        let inner = Math.min(0, Math.max(dx, dy, dz));

        let dx0 = Math.max(dx, 0);
        let dy0 = Math.max(dy, 0);
        let dz0 = Math.max(dz, 0);
        let outer = Math.sqrt(dx0 * dx0 + dy0 * dy0 + dz0 * dz0);

        let distance = inner + outer;

        return new DistanceShaderPair(distance, shader);
    }
}

//Transformations
function translate(sdf, translation) {
    return function(p) {
        return sdf(p.sub(translation));
    } 
}

function rotateX(sdf, rotation) {
    let sin = Math.sin(rotation);
    let cos = Math.cos(rotation);

    return function(p) {
        let y = cos * p.y - sin * p.z;
        let z = sin * p.y + cos * p.z;
        return sdf(new Vector(p.x, y, z));
    }
}

function rotateY(sdf, rotation) {
    let sin = Math.sin(rotation);
    let cos = Math.cos(rotation);

    return function(p) {
        let x = cos * p.x - sin * p.z;
        let z = sin * p.x + cos * p.z;
        return sdf(new Vector(x, p.y, z));
    }
}
//Combinations
function union(sdf1, sdf2) {
    return function(p) {
        var a = sdf1(p);
        var b = sdf2(p);

        if(a.distance < b.distance) {
            return a;
        }
        else {
            return b;
        }
    }
}

function intersection(sdf1, sdf2) {
    return function(p) {
        var a = sdf1(p);
        var b = sdf2(p);

        if(a.distance > b.distance) {
            return a;
        }
        else {
            return b;
        }
    }
}

function subtraction(sdf1, sdf2) {
    return function(p) {
        var a = sdf1(p);
        var b = sdf2(p);

        b.distance *= -1;
        if(a.distance > b.distance) {
            return a;
        }
        else {
            return b;
        }
    }
}
//Shaders
class ConstantColor {
    constructor(r, g, b) {
        this.color = new Vector(r, g, b);
    }

    shade(ray, scene) {
        return this.color;
    }
}

class Lambertian {
    constructor(r, g, b) {
        this.color = new Vector(r, g, b);
    }

    shade(ray, scene) {
        var[lightDir, lightColor] = scene.sampleDirectionalLight();
        var normal = scene.normal(ray.origin);

        var sdfHit = ray.origin.add(ray.direction.mul(-0.1));
        var shadowRay = new Ray(sdfHit, lightDir.clone());
        var distance = scene.sdf(shadowRay.origin).distance;

        while(shadowRay.origin.norm() < scene.backgroundDistance && Math.abs(distance) > 0.000001) {
            shadowRay.origin = shadowRay.origin.add(shadowRay.direction.mul(distance));
            distance = scene.sdf(shadowRay.origin).distance;
        }

        var shadowMult = 0.3;
        if(shadowRay.origin.norm() >= scene.backgroundDistance) {
            shadowMult = 1;
        }

        return this.color.compProduct(lightColor).mul(Math.max(0, normal.dotProduct(lightDir))).mul(shadowMult);
    }
}

function realMod(a, b) {
    return ((a % b) + b) % b;
}

class Checkerboard {
    constructor(shader1, shader2, tileSize = 1) {
        this.shader1 = shader1;
        this.shader2 = shader2;
        this.tileSize = tileSize;
    }

    shade(ray, scene) {
        var p = ray.origin;
        var x = realMod(p.x, this.tileSize * 2) > this.tileSize;
        var y = realMod(p.y, this.tileSize * 2) > this.tileSize;
        var z = realMod(p.z, this.tileSize * 2) > this.tileSize;

        if(x ^ y ^ z) {
            return this.shader1.shade(ray, scene);
        }
        else {
            return this.shader2.shade(ray, scene);
        }
    }
}

function show(img) {
    var canvas = document.getElementById("renderCanvas");
    var width = canvas.getAttribute("width");
    var height = canvas.getAttribute("height");
    var ctx = canvas.getContext("2d");

    for(var x = 0; x < width; x++) {
        for(var y = 0; y < height; y++) {
            ctx.fillStyle = "rgba(" + (img[x][y].x * 255) + ", " + (img[x][y].y * 255) + ", " + (img[x][y].z * 255) +  ")";
            ctx.fillRect(x, y, 1, 1);
        }
    }
}

function main() {
    var canvas = document.getElementById("renderCanvas");
    var width = canvas.getAttribute("width");
    var height = canvas.getAttribute("height");

    film = new Film(width, height);
    camera = new PerspectiveCamera();
    background = new Background();
    
    sdf_checkerboard = YPlane(-Math.sqrt(2), new Checkerboard(new Lambertian(1, 1, 1), new Lambertian(0, 0, 0)));
    
    /*sdf_rect = Rect(3, 2, 2, new Lambertian(0.2, 0.5, 0.4));
    sdf_rect = rotateX(sdf_rect, Math.PI / 4);
    sdf_rect = rotateY(sdf_rect, Math.PI / 4);
    sdf_rect = translate(sdf_rect, new Vector(0, 0, -10));*/

    sdf_cube = Cube(2, new Lambertian(0.2, 0.8, 0.2));
    sdf_sphere = Sphere(1.3, new Lambertian(0.7, 0.1, 0.2));
    sdf_sphere2 = Sphere(0.7, new Lambertian(0.2, 0.5, 0.4));

    sdf_cube = subtraction(sdf_cube, sdf_sphere);

    sdf_cube = rotateY(sdf_cube, Math.PI / 4);
    sdf_cube = rotateX(sdf_cube, Math.PI / 4);

    sdf_cube = union(sdf_cube, sdf_sphere2);
    sdf_cube = translate(sdf_cube, new Vector(0, 0, -10));

    sdf = union(sdf_checkerboard, sdf_cube);

    /*sdf = union(sdf_checkerboard, sdf_rect);*/

    show(film.trigger(camera, new RayMarcher(sdf, background), 16));
}

window.onload = main;