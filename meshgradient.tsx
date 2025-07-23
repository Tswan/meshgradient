import { addPropertyControls, ControlType } from "framer"
import React, { useRef, useEffect } from "react"
import chroma from "chroma-js"
import {
    createBufferInfoFromArrays,
    createProgramInfo,
    drawBufferInfo,
    resizeCanvasToDisplaySize,
    setBuffersAndAttributes,
    setUniforms,
} from "twgl.js"

/** @framerDisableUnlink
 * @framerSupportedLayoutWidth any-prefer-fixed
 * @framerSupportedLayoutHeight any-prefer-fixed
 * @framerIntrinsicWidth 200
 * @framerIntrinsicHeight 200
 */

export default function MeshGradient(props) {
    const { baseColor, noise, animate } = props
    const colors =
        props.colors.length !== 0
            ? props.colors
            : [
                  { color: "rgb(255,0,0)", x: 0, y: 0, radius: 10 },
                  { color: "rgb(0,255,0)", x: 80, y: 20, radius: 10 },
                  { color: "rgb(0,0,255)", x: 50, y: 50, radius: 10 },
              ]
    const canvasRef = useRef<HTMLCanvasElement | null>(null)
    const rafId = useRef<number | null>(null)

    useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas) return

        const gl = canvas.getContext("webgl")
        if (!gl) {
            console.error("WebGL not supported.")
            return
        }

        const vertexShaderSource = `attribute vec4 position; void main() { gl_Position = position; }`
        const fragmentShaderSource = generateFragmentShader(colors.length)

        const programInfo = createProgramInfo(gl, [
            vertexShaderSource,
            fragmentShaderSource,
        ])
        const arrays = {
            position: [
                -1, -1, 0, 1, -1, 0, -1, 1, 0, -1, 1, 0, 1, -1, 0, 1, 1, 0,
            ],
        }
        const bufferInfo = createBufferInfoFromArrays(gl, arrays)

        const draw = (time: number) => {
            resizeCanvasToDisplaySize(gl.canvas as HTMLCanvasElement)
            gl.viewport(0, 0, gl.canvas.width, gl.canvas.height)

            const chromaColor = chroma(baseColor).gl()

            const uBaseColor = {
                r: chromaColor[0],
                g: chromaColor[1],
                b: chromaColor[2],
                a: chromaColor[3],
            }

            const colorArray = colors
                .map((c) => {
                    const rgba = chroma(c.color).gl()
                    return [rgba[0], rgba[1], rgba[2], rgba[3]]
                })
                .flat()

            const positions = colors
                .map((c, i) => {
                    const offset = animate
                        ? Math.sin(time * 0.001 + i) * 0.1
                        : 0
                    return [c.x / 100 + offset, 1 - c.y / 100 + offset]
                })
                .flat()

            const radii = colors.map((c) => c.radius / 10)

            const uniforms = {
                u_resolution: [gl.canvas.width, gl.canvas.height],
                u_baseColor: [
                    uBaseColor.r,
                    uBaseColor.g,
                    uBaseColor.b,
                    uBaseColor.a,
                ],
                u_noise: noise,
                u_colors: new Float32Array(colorArray),
                u_positions: new Float32Array(positions),
                u_radius: new Float32Array(radii),
                u_time: animate ? time * 0.001 : 1,
            }

            gl.useProgram(programInfo.program)
            setBuffersAndAttributes(gl, programInfo, bufferInfo)
            setUniforms(programInfo, uniforms)
            drawBufferInfo(gl, bufferInfo)

            if (animate) rafId.current = requestAnimationFrame(draw)
        }

        draw(0) // Render once or start animating

        return () => {
            if (rafId.current) cancelAnimationFrame(rafId.current)
        }
    }, [baseColor, noise, animate, JSON.stringify(colors)])

    return (
        <canvas
            ref={canvasRef}
            style={{ width: "100%", height: "100%", display: "block" }}
        />
    )
}

// ---------- Shader generation ----------
function generateFragmentShader(count: number) {
    return `
        precision mediump float;

        uniform vec2 u_resolution;
        uniform vec4 u_baseColor;
        uniform float u_noise;
        uniform vec4 u_colors[${Math.max(1, count)}];
        uniform vec2 u_positions[${Math.max(1, count)}];
        uniform float u_radius[${Math.max(1, count)}];
        uniform float u_time;

        vec3 mod289(vec3 x) {
            return x - floor(x * (1.0 / 289.0)) * 289.0;
        }
        float mod289(float x) {
            return x - floor(x * (1.0 / 289.0)) * 289.0;
        }
        float permute(float x) {
            return mod289(((x * 34.0) + 10.0) * x);
        }
        vec2 rgrad2(vec2 p, float rot) {
            float u = permute(permute(p.x) + p.y) * 0.0243902439 + rot;
            u = fract(u) * 6.28318530718;
            return vec2(cos(u), sin(u));
        }
        vec3 psrdnoise(vec2 pos, vec2 per, float rot) {
            pos.y += 0.01;
            vec2 uv = vec2(pos.x + pos.y * 0.5, pos.y);
            vec2 i0 = floor(uv);
            vec2 f0 = fract(uv);
            vec2 i1 = (f0.x > f0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
            vec2 p0 = vec2(i0.x - i0.y * 0.5, i0.y);
            vec2 p1 = vec2(p0.x + i1.x - i1.y * 0.5, p0.y + i1.y);
            vec2 p2 = vec2(p0.x + 0.5, p0.y + 1.0);
            vec2 d0 = pos - p0;
            vec2 d1 = pos - p1;
            vec2 d2 = pos - p2;
            vec3 xw = mod(vec3(p0.x, p1.x, p2.x), per.x);
            vec3 yw = mod(vec3(p0.y, p1.y, p2.y), per.y);
            vec3 iuw = xw + 0.5 * yw;
            vec3 ivw = yw;
            vec2 g0 = rgrad2(vec2(iuw.x, ivw.x), rot);
            vec2 g1 = rgrad2(vec2(iuw.y, ivw.y), rot);
            vec2 g2 = rgrad2(vec2(iuw.z, ivw.z), rot);
            vec3 w = vec3(dot(g0, d0), dot(g1, d1), dot(g2, d2));
            vec3 t = 0.8 - vec3(dot(d0, d0), dot(d1, d1), dot(d2, d2));
            t = max(t, 0.0);
            vec3 t4 = t * t * t * t;
            return 11.0 * vec3(dot(t4, w));
        }

        vec4 blendAverage(vec4 base, vec4 blend) {
            return (base + blend) / 2.0;
        }

        // Elliptical distance calculation
        float ellipticalDistance(vec2 uv, vec2 center, vec2 radii, float angle) {
            vec2 toUV = uv - center;

            // Rotate UV coordinates by the angle
            float cosA = cos(angle);
            float sinA = sin(angle);
            vec2 rotated = vec2(cosA * toUV.x + sinA * toUV.y, -sinA * toUV.x + cosA * toUV.y);
            // Scale coordinates to create an ellipse
            vec2 scaled = rotated / radii;

            // Return the distance in elliptical space
            return length(scaled);
        }
        void main() {
            vec2 uv = gl_FragCoord.xy / u_resolution;
            vec4 color = u_baseColor;
            vec2 canvasCenter = vec2(0.5, 0.5);
            for (int i = 0; i < ${Math.max(1, count)}; i++) {
                vec2 position = u_positions[i];
                vec4 gradientColor = u_colors[i];
                float radius = u_radius[i];

                 // Calculate the angle pointing towards the center
                vec2 toCenter = canvasCenter - position;
                toCenter.y = -toCenter.y;
                float angle = atan(toCenter.x, toCenter.y);
                for (float dx = -2.0; dx <= 2.0; dx++) {
                    for (float dy = -2.0; dy <= 2.0; dy++) {
                        float noise = psrdnoise(uv * u_noise, vec2(10.0), 0.0).x;
                        vec2 samplePos = position + vec2(dx, dy) * 0.005 + vec2(noise) * 0.01;
                        float eDist = ellipticalDistance(uv, samplePos, vec2(radius), angle);
                        float dist = eDist > 0.0 ? eDist : distance(uv, position);
                        float weight = 1.0 - smoothstep(0.001, 0.5, dist);
                        color = mix(color, blendAverage(color, gradientColor), weight * 0.1);
                    }
                }
            }
            gl_FragColor = color;
        }
    `
}

// ---------- Framer controls ----------
addPropertyControls(MeshGradient, {
    baseColor: {
        title: "Base Color",
        type: ControlType.Color,
        defaultValue: "#FFFFFF",
    },
    noise: {
        title: "Noise",
        type: ControlType.Number,
        min: 0,
        max: 100,
        defaultValue: 10,
    },
    colors: {
        title: "Colors",
        type: ControlType.Array,
        defaultValue: [
            { color: "#FF0000", x: 0, y: 0, radius: 10 },
            { color: "#00FF00", x: 80, y: 20, radius: 10 },
            { color: "#0000FF", x: 50, y: 50, radius: 10 },
        ],
        propertyControl: {
            title: "Mesh Color",
            type: ControlType.Object,
            controls: {
                color: {
                    title: "Color",
                    type: ControlType.Color,
                    defaultValue: "#FFF",
                },
                x: {
                    title: "X Position",
                    type: ControlType.Number,
                    min: 0,
                    max: 100,
                    defaultValue: 50,
                },
                y: {
                    title: "Y Position",
                    type: ControlType.Number,
                    min: 0,
                    max: 100,
                    defaultValue: 50,
                },
                radius: {
                    title: "Radius",
                    type: ControlType.Number,
                    min: 0,
                    max: 100,
                    defaultValue: 10,
                },
            },
        },
    },
    animate: {
        title: "Animate",
        type: ControlType.Boolean,
        defaultValue: false,
        enabledTitle: "Yes",
        disabledTitle: "No",
    },
})

MeshGradient.defaultProps = {
    baseColor: "#FFFFFF",
    noise: 10,
    colors: [
        { color: "rgb(255,0,0)", x: 0, y: 0, radius: 10 },
        { color: "rgb(0,255,0)", x: 80, y: 20, radius: 10 },
        { color: "rgb(0,0,255)", x: 50, y: 50, radius: 10 },
    ],
    animate: false,
}
