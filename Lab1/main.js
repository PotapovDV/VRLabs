'use strict';

//init()
let canvas;
let context;
let gl;
let trackball;
let video;
//initGL
let iAttribVertex;
let iAttribTexture;
let iColor;
let iColorCoef;
let iModelViewProjectionMatrix;
let iTextureMappingUnit;
let iVertexBuffer;
let iTexBuffer;
//draw
let rotationMatrix = getRotationMatrix();
//Stereo3D
let eyeSep = 50; //EyeSeparation
let conver = 2000; //ConvergenceDistance
let FOV = 90; //FieldOfView
let NCD = 1; // NearClippingDistance
let FCD = 20000; //FarClippingDistance
let Wired = false;
var texture;

const h = 10;
const p = 8;

const width = 900,
    height = 600;


navigator.mediaDevices.getUserMedia({
        video: true
    })
    .then((stream) => {
        // Set the video source to the webcam stream
        video.srcObject = stream;

        // Wait for the video to load metadata
        video.onloadedmetadata = function () {
            // Update the canvas size to match the video dimensions
            canvas.width = width;
            canvas.height = height;

            // Start the video playback
            video.play();

            // Continuously update the canvas with the video frames
            function updateCanvas() {
                gl.bindTexture(gl.TEXTURE_2D, texture);
                gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video);
                draw();
            }
            // Start updating the canvas
            updateCanvas();
        };
    })
    .catch((error) => {
        console.error('Error accessing the webcam: ', error);
    });


const x = (v, u) => Math.pow(Math.abs(v) - h, 2) / (2 * p) * Math.cos(u);
const y = (v, u) => Math.pow(Math.abs(v) - h, 2) / (2 * p) * Math.sin(u);

class Stereo3D {

    constructor(EyeSeparation, Convergence, AspectRatio, FieldOfView, NearClippingDistance, FarClippingDistance) {
        this.EyeSep = EyeSeparation;
        this.Conver = Convergence;
        this.Aspect = AspectRatio;
        this.FOV = FieldOfView * Math.PI / 180
        this.NCD = NearClippingDistance;
        this.FCD = FarClippingDistance;

        this.top = this.NCD * Math.tan(this.FOV / 2);
        this.bottom = -this.top;
        this.a = this.Aspect * Math.tan(this.FOV / 2) * this.Conver;
        this.b = this.a - this.EyeSep / 2;
        this.c = this.a + this.EyeSep / 2;
    }

    getLeft() {
        const left = -this.b * this.NCD / this.Conver;
        const right = this.c * this.NCD / this.Conver;

        const translate = m4.translation(this.EyeSep / 2 / 100, 0, 0);

        const projection = m4.frustum(left, right, this.bottom, this.top, this.NCD, this.FCD);
        return m4.multiply(projection, translate)
    }

    getRight() {
        const left = -this.c * this.NCD / this.Conver;
        const right = this.b * this.NCD / this.Conver;

        const translate = m4.translation(-this.EyeSep / 2 / 100, 0, 0);

        const projection = m4.frustum(left, right, this.bottom, this.top, this.NCD, this.FCD);

        return m4.multiply(projection, translate)
    }
}


function init() {
    canvas = document.getElementById("canvas");
    video = document.getElementById('video');
    gl = canvas.getContext("webgl");
    initGL();
    trackball = new TrackballRotator(canvas, draw, 0);
    texture = gl.createTexture();
    
    draw();
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();
}

function resizeCanvas() {
    // Set the canvas size to match the video dimensions
    canvas.width = video.clientWidth;
    canvas.height = video.clientHeight;
    draw();
}


function initGL() {
    let prog = createProgram(gl, vertexShaderSource, fragmentShaderSource);
    gl.useProgram(prog);

    iAttribVertex = gl.getAttribLocation(prog, "vertex");
    iAttribTexture = gl.getAttribLocation(prog, "texCoord");
    iModelViewProjectionMatrix = gl.getUniformLocation(prog, "ModelViewProjectionMatrix");
    iColor = gl.getUniformLocation(prog, "color");
    iColorCoef = gl.getUniformLocation(prog, "fColorCoef");
    iTextureMappingUnit = gl.getUniformLocation(prog, "u_texture");
    iVertexBuffer = gl.createBuffer();
    iTexBuffer = gl.createBuffer();
    gl.enable(gl.DEPTH_TEST);
}

function createProgram(gl, vShader, fShader) {
    let vsh = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vsh, vShader);
    gl.compileShader(vsh);

    let fsh = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fsh, fShader);
    gl.compileShader(fsh);

    let prog = gl.createProgram();
    gl.attachShader(prog, vsh);
    gl.attachShader(prog, fsh);
    gl.linkProgram(prog);

    return prog;
}

function draw() {
    gl.clearColor(0.0, 0.0, 0.0, 0.0); // Set the canvas background color to transparent
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    const aspect = gl.canvas.clientWidth / gl.canvas.clientHeight;

    let modelView = trackball.getViewMatrix();
    let rotation = m4.axisRotation([-1, 1, 0.625], Math.PI / 2);
    let shift = m4.translation(0, 0, -12);
    let matrix = m4.multiply(shift, m4.multiply(m4.multiply(rotation, modelView), rotationMatrix));
    let cam = new Stereo3D(eyeSep, conver, aspect, FOV, NCD, FCD);
    let modelViewLeft = m4.multiply(cam.getLeft(), matrix);
    let modelViewRight = m4.multiply(cam.getRight(), matrix);


    gl.uniformMatrix4fv(iModelViewProjectionMatrix, false, modelViewLeft);
    gl.colorMask(true, false, false, false);

    DrawFigure();

    gl.clear(gl.DEPTH_BUFFER_BIT);
    gl.uniformMatrix4fv(iModelViewProjectionMatrix, false, modelViewRight);
    gl.colorMask(false, true, true, false);

    DrawFigure();
    gl.clear(gl.DEPTH_BUFFER_BIT);

    gl.colorMask(true, true, true, true);
}

function DrawFigure() {
    let allpoints = [];
    let i = 0;
    for (let u = 0; u <= 2 * Math.PI; u += Math.PI / 12) {
        let points = [];
        for (let v = -h; v < h; v += 0.5) {
            const data = [
                x(Math.pow(Math.abs(v) - h, 2) / (2 * p), u),
                y(Math.pow(Math.abs(v) - h, 2) / (2 * p), u),
                v,
            ];
            points.push(...data);
        }
        drawPrimitive(gl.LINE_STRIP, [1, 1, 0, 1], points);
        allpoints[i++] = [...points];
        points = [];
    }

    for (let j = 0; j < allpoints[0].length; j += 3) {
        let points = [];
        for (let k = 0; k < allpoints.length; k++) {
            points.push(allpoints[k][j], allpoints[k][j + 1], allpoints[k][j + 2]);
        }
        drawPrimitive(gl.LINE_STRIP, [1, 0, 0, 1], points);
        points = [];
    }

    if (!Wired) {
        for (let i = 0; i < allpoints.length - 1; i++) {
            let points = [];
            for (let j = 0; j < allpoints[i].length; j += 3) {
                points.push(
                    allpoints[i][j],
                    allpoints[i][j + 1],
                    allpoints[i][j + 2]
                );
                points.push(
                    allpoints[i + 1][j],
                    allpoints[i + 1][j + 1],
                    allpoints[i + 1][j + 2]
                );
                points.push(
                    allpoints[i][j + 3],
                    allpoints[i][j + 4],
                    allpoints[i][j + 5]
                );
                points.push(
                    allpoints[i + 1][j + 3],
                    allpoints[i + 1][j + 4],
                    allpoints[i + 1][j + 5]
                );
            }
            drawPrimitive(gl.TRIANGLE_STRIP, [0.5, 0, 0.5, 1], points);
            points = [];
        }
    }

    //Coordinate AXES
    gl.lineWidth(4);
    drawPrimitive(gl.LINES, [1, 0, 0, 1], [-9, 0, 0, 9, 0, 0]);
    drawPrimitive(gl.LINES, [0, 1, 0, 1], [0, -9, 0, 0, 9, 0]);
    drawPrimitive(gl.LINES, [0, 0, 1, 1], [0, 0, -9, 0, 0, 9]);
    gl.lineWidth(1);
}

function drawPrimitive(primitiveType, color, vertices, texCoords) {
    gl.uniform4fv(iColor, color);
    gl.uniform1f(iColorCoef, 0.0);

    gl.enableVertexAttribArray(iAttribVertex);
    gl.bindBuffer(gl.ARRAY_BUFFER, iVertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STREAM_DRAW);
    gl.vertexAttribPointer(iAttribVertex, 3, gl.FLOAT, false, 0, 0);

    if (texCoords) {
        gl.enableVertexAttribArray(iAttribTexture);
        gl.bindBuffer(gl.ARRAY_BUFFER, iTexBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(texCoords), gl.STREAM_DRAW);
        gl.vertexAttribPointer(iAttribTexture, 2, gl.FLOAT, false, 0, 0);
    } else {
        gl.disableVertexAttribArray(iAttribTexture);
        gl.vertexAttrib2f(iAttribTexture, 0.0, 0.0);
        gl.uniform1f(iColorCoef, 1.0);
    }

    gl.drawArrays(primitiveType, 0, vertices.length / 3);
}

function handleCheckboxChange() {
    Wired = document.getElementById("Wired").checked;
    draw();
}

function handleEyeSeparationChange() {
    eyeSep = parseInt(document.getElementById("eye_sep").value);
    draw();
}

function handleFieldOfViewChange() {
    FOV = parseInt(document.getElementById("FOV").value);
    draw();
}

function handleNearClipDistanceChange() {
    NCD = parseInt(document.getElementById("NCD").value);
    draw();
}

function handleConvergenceChange() {
    conver = parseInt(document.getElementById("conver").value);
    draw();
}

const degtorad = Math.PI / 180; // Degree-to-Radian conversion

function getRotationMatrix(alpha, beta, gamma) {

    const _x = beta ? -beta * degtorad : 0; // beta value
    const _y = gamma ? -gamma * degtorad : 0; // gamma value
    const _z = alpha ? -alpha * degtorad : 0; // alpha value

    const cX = Math.cos(_x);
    const cY = Math.cos(_y);
    const cZ = Math.cos(_z);
    const sX = Math.sin(_x);
    const sY = Math.sin(_y);
    const sZ = Math.sin(_z);

    //
    // ZXY rotation matrix construction.
    //

    const m11 = cZ * cY - sZ * sX * sY;
    const m12 = -cX * sZ;
    const m13 = cY * sZ * sX + cZ * sY;

    const m21 = cY * sZ + cZ * sX * sY;
    const m22 = cZ * cX;
    const m23 = sZ * sY - cZ * cY * sX;

    const m31 = -cX * sY;
    const m32 = sX;
    const m33 = cX * cY;

    return [
        m11, m12, m13, 0,
        m21, m22, m23, 0,
        m31, m32, m33, 0,
        0, 0, 0, 1
    ];

}

window.addEventListener('deviceorientation', function (event) {
    rotationMatrix = getRotationMatrix(event.alpha, event.beta, event.gamma);
    draw();
});




function TrackballRotator(canvas, callback, viewDistance, viewpointDirection, viewUp) {
    var unitx = new Array(3);
    var unity = new Array(3);
    var unitz = new Array(3);
    var viewZ; // view distance; z-coord in eye points;
    var center; // center of view; rotation is about this point; default is [0,0,0] 
    this.setView = function (viewDistance, viewpointDirection, viewUp) {
        unitz = (viewpointDirection === undefined) ? [0, 0, 10] : viewpointDirection;
        viewUp = (viewUp === undefined) ? [0, 1, 0] : viewUp;
        viewZ = viewDistance;
        normalize(unitz, unitz);
        copy(unity, unitz);
        scale(unity, unity, dot(unitz, viewUp));
        subtract(unity, viewUp, unity);
        normalize(unity, unity);
        cross(unitx, unity, unitz);
    };
    this.getViewMatrix = function () {
        var mat = [unitx[0], unity[0], unitz[0], 0,
            unitx[1], unity[1], unitz[1], 0,
            unitx[2], unity[2], unitz[2], 0,
            0, 0, 0, 1
        ];
        if (center !== undefined) { // multiply on left by translation by rotationCenter, on right by translation by -rotationCenter
            var t0 = center[0] - mat[0] * center[0] - mat[4] * center[1] - mat[8] * center[2];
            var t1 = center[1] - mat[1] * center[0] - mat[5] * center[1] - mat[9] * center[2];
            var t2 = center[2] - mat[2] * center[0] - mat[6] * center[1] - mat[10] * center[2];
            mat[12] = t0;
            mat[13] = t1;
            mat[14] = t2;
        }
        if (viewZ !== undefined) {
            mat[14] -= viewZ;
        }
        return mat;
    };
    this.getViewDistance = function () {
        return viewZ;
    };
    this.setViewDistance = function (viewDistance) {
        viewZ = viewDistance;
    };
    this.getRotationCenter = function () {
        return (center === undefined) ? [0, 0, 0] : center;
    };
    this.setRotationCenter = function (rotationCenter) {
        center = rotationCenter;
    };
    this.setView(viewDistance, viewpointDirection, viewUp);
    canvas.addEventListener("mousedown", doMouseDown, false);
    canvas.addEventListener("touchstart", doTouchStart, false);

    function applyTransvection(e1, e2) { // rotate vector e1 onto e2
        function reflectInAxis(axis, source, destination) {
            var s = 2 * (axis[0] * source[0] + axis[1] * source[1] + axis[2] * source[2]);
            destination[0] = s * axis[0] - source[0];
            destination[1] = s * axis[1] - source[1];
            destination[2] = s * axis[2] - source[2];
        }
        normalize(e1, e1);
        normalize(e2, e2);
        var e = [0, 0, 0];
        add(e, e1, e2);
        normalize(e, e);
        var temp = [0, 0, 0];
        reflectInAxis(e, unitz, temp);
        reflectInAxis(e1, temp, unitz);
        reflectInAxis(e, unitx, temp);
        reflectInAxis(e1, temp, unitx);
        reflectInAxis(e, unity, temp);
        reflectInAxis(e1, temp, unity);
    }
    var centerX, centerY, radius2;
    var prevx, prevy;
    var dragging = false;

    function doMouseDown(evt) {
        if (dragging)
            return;
        dragging = true;
        centerX = canvas.width / 2;
        centerY = canvas.height / 2;
        var radius = Math.min(centerX, centerY);
        radius2 = radius * radius;
        document.addEventListener("mousemove", doMouseDrag, false);
        document.addEventListener("mouseup", doMouseUp, false);
        var box = canvas.getBoundingClientRect();
        prevx = evt.clientX - box.left;
        prevy = evt.clientY - box.top;
    }

    function doMouseDrag(evt) {
        if (!dragging)
            return;
        var box = canvas.getBoundingClientRect();
        var x = evt.clientX - box.left;
        var y = evt.clientY - box.top;
        var ray1 = toRay(prevx, prevy);
        var ray2 = toRay(x, y);
        applyTransvection(ray1, ray2);
        prevx = x;
        prevy = y;
        if (callback) {
            callback();
        }
    }

    function doMouseUp(evt) {
        if (dragging) {
            document.removeEventListener("mousemove", doMouseDrag, false);
            document.removeEventListener("mouseup", doMouseUp, false);
            dragging = false;
        }
    }

    function doTouchStart(evt) {
        if (evt.touches.length != 1) {
            doTouchCancel();
            return;
        }
        evt.preventDefault();
        var r = canvas.getBoundingClientRect();
        prevx = evt.touches[0].clientX - r.left;
        prevy = evt.touches[0].clientY - r.top;
        canvas.addEventListener("touchmove", doTouchMove, false);
        canvas.addEventListener("touchend", doTouchEnd, false);
        canvas.addEventListener("touchcancel", doTouchCancel, false);
        touchStarted = true;
        centerX = canvas.width / 2;
        centerY = canvas.height / 2;
        var radius = Math.min(centerX, centerY);
        radius2 = radius * radius;
    }

    function doTouchMove(evt) {
        if (evt.touches.length != 1 || !touchStarted) {
            doTouchCancel();
            return;
        }
        evt.preventDefault();
        var r = canvas.getBoundingClientRect();
        var x = evt.touches[0].clientX - r.left;
        var y = evt.touches[0].clientY - r.top;
        var ray1 = toRay(prevx, prevy);
        var ray2 = toRay(x, y);
        applyTransvection(ray1, ray2);
        prevx = x;
        prevy = y;
        if (callback) {
            callback();
        }
    }

    function doTouchEnd(evt) {
        doTouchCancel();
    }

    function doTouchCancel() {
        if (touchStarted) {
            touchStarted = false;
            canvas.removeEventListener("touchmove", doTouchMove, false);
            canvas.removeEventListener("touchend", doTouchEnd, false);
            canvas.removeEventListener("touchcancel", doTouchCancel, false);
        }
    }

    function toRay(x, y) { // converts a point (x,y) in pixel coords to a 3D ray by mapping interior of
        // a circle in the plane to a hemisphere with that circle as equator.
        var dx = x - centerX;
        var dy = centerY - y;
        var vx = dx * unitx[0] + dy * unity[0]; // The mouse point as a vector in the image plane.
        var vy = dx * unitx[1] + dy * unity[1];
        var vz = dx * unitx[2] + dy * unity[2];
        var dist2 = vx * vx + vy * vy + vz * vz;
        if (dist2 > radius2) { // Map a point ouside the circle to itself
            return [vx, vy, vz];
        } else {
            var z = Math.sqrt(radius2 - dist2);
            return [vx + z * unitz[0], vy + z * unitz[1], vz + z * unitz[2]];
        }
    }

    function dot(v, w) {
        return v[0] * w[0] + v[1] * w[1] + v[2] * w[2];
    }

    function length(v) {
        return Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
    }

    function normalize(v, w) {
        var d = length(w);
        v[0] = w[0] / d;
        v[1] = w[1] / d;
        v[2] = w[2] / d;
    }

    function copy(v, w) {
        v[0] = w[0];
        v[1] = w[1];
        v[2] = w[2];
    }

    function add(sum, v, w) {
        sum[0] = v[0] + w[0];
        sum[1] = v[1] + w[1];
        sum[2] = v[2] + w[2];
    }

    function subtract(dif, v, w) {
        dif[0] = v[0] - w[0];
        dif[1] = v[1] - w[1];
        dif[2] = v[2] - w[2];
    }

    function scale(ans, v, num) {
        ans[0] = v[0] * num;
        ans[1] = v[1] * num;
        ans[2] = v[2] * num;
    }

    function cross(c, v, w) {
        var x = v[1] * w[2] - v[2] * w[1];
        var y = v[2] * w[0] - v[0] * w[2];
        var z = v[0] * w[1] - v[1] * w[0];
        c[0] = x;
        c[1] = y;
        c[2] = z;
    }
}


// Vertex shader
const vertexShaderSource = `
attribute vec3 vertex;
attribute vec2 texCoord;
uniform mat4 ModelViewProjectionMatrix;
varying vec2 v_texcoord;

void main() {
    gl_Position = ModelViewProjectionMatrix * vec4(vertex,1.0);
    v_texcoord = texCoord;
}`;


// Fragment shader
const fragmentShaderSource = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
   precision highp float;
#else
   precision mediump float;
#endif

uniform sampler2D u_texture;
uniform float fColorCoef;

varying vec2 v_texcoord;

uniform vec4 color;
void main() {
    gl_FragColor = color*fColorCoef + texture2D(u_texture, v_texcoord)*(1.0-fColorCoef);
}`;
