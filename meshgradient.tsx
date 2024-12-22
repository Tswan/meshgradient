import { addPropertyControls, ControlType } from "framer"
import React, { useRef, useEffect } from "react"
import {
    createBufferInfoFromArrays,
    createProgramInfo,
    drawBufferInfo,
    resizeCanvasToDisplaySize,
    setBuffersAndAttributes,
    setUniforms,
} from "twgl.js"

/** @framerDisableUnlink
 * @framerSupportedLayoutWidth any
 * @framerSupportedLayoutHeight any
 */

export default function MeshGradient(props) {
    const { baseColor, noise, colors, animate } = props

    const canvasRef = (element: HTMLCanvasElement) => {
        if (!element) return

        const gl = element.getContext("webgl")
        if (!gl) {
            console.error("WebGL not supported.")
            return
        }

        const vertexShaderSource = `
                attribute vec4 position;

                void main() {
                    gl_Position = position;
                }
            `

        const fragmentShaderSource = `
                precision mediump float;

                uniform vec2 u_resolution;
                uniform vec4 u_baseColor; // Background color with alpha
                uniform float u_noise;
                uniform vec4 u_colors[${colors.length}];
                uniform vec2 u_positions[${colors.length}];

                // Functions for simplex noise (psrdnoise is included here)
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
                    u = fract(u) * 6.28318530718; // 2*pi
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

                // Color blending and randomness
                vec4 blendAverage(vec4 base, vec4 blend) {
                    return (base + blend) / 2.0;
                }

                void main() {
                    vec2 uv = gl_FragCoord.xy / u_resolution;
                    vec4 color = u_baseColor;

                    for (int i = 0; i < ${colors.length}; i++) {
                        vec2 position = u_positions[i];
                        vec4 gradientColor = u_colors[i];

                        // Gaussian weights for blending
                        for (float dx = -2.0; dx <= 2.0; dx++) {
                            for (float dy = -2.0; dy <= 2.0; dy++) {
                                float noise = psrdnoise(uv * u_noise, vec2(10.0, 10.0), 0.0).x; // Apply noise
                                vec2 samplePos = position + vec2(dx, dy) * 0.005 + vec2(noise) * 0.01; // Blend noise into position
                                float dist = distance(uv, samplePos);
                                float weight = 1.0 - smoothstep(0.1, 0.5, dist);
                                color = mix(color, blendAverage(color, gradientColor), weight * 0.05);
                            }
                        }
                    }

                    gl_FragColor = color;
                }
            `

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

        function render(time: number) {
            if (!gl?.canvas) return

            // Resize canvas
            resizeCanvasToDisplaySize(gl.canvas as HTMLCanvasElement)
            gl.viewport(0, 0, gl.canvas.width, gl.canvas.height)

            const uBaseColor = parseRgbaString(baseColor)

            // Parse gradient colors
            const colorArray = colors.map((c) => {
                const rgba = parseRgbaString(c.color)
                return [rgba.r / 255, rgba.g / 255, rgba.b / 255, rgba.a]
            })
            const flattenedColors = colorArray.flat()

            // Animate positions over time
            const positions = colors.map((c, i) => {
                const offset = !animate ? 0 : Math.sin(time * 0.001 + i) * 0.1 // Add oscillation
                return [c.x / 100 + offset, 1 - c.y / 100 + offset]
            })
            const flattenedPositions = positions.flat()

            const uniforms = {
                u_resolution: [gl.canvas.width, gl.canvas.height],
                u_baseColor: [
                    uBaseColor.r / 255,
                    uBaseColor.g / 255,
                    uBaseColor.b / 255,
                    uBaseColor.a,
                ],
                u_noise: 0,
                u_colors: new Float32Array(flattenedColors),
                u_positions: new Float32Array(flattenedPositions),
            }

            gl.useProgram(programInfo.program)
            setBuffersAndAttributes(gl, programInfo, bufferInfo)
            setUniforms(programInfo, uniforms)
            drawBufferInfo(gl, bufferInfo)

            requestAnimationFrame(render)
        }

        requestAnimationFrame(render)
    }

    return (
        <canvas
            ref={canvasRef}
            style={{
                width: "100%",
                height: "100%",
                display: "block",
            }}
        />
    )
}

function parseRgbaString(rgbaString) {
    const match = rgbaString.match(
        /rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([01](?:\.\d+)?))?\)/
    )
    if (!match) {
        console.error(`Invalid color string: ${rgbaString}`)
        return { r: 0, g: 0, b: 0, a: 1 }
    }
    return {
        r: parseInt(match[1], 10),
        g: parseInt(match[2], 10),
        b: parseInt(match[3], 10),
        a: match[4] !== undefined ? parseFloat(match[4]) : 1,
    }
}

MeshGradient.defaultProps = {
    baseColor: "#FFFFFF",
    noise: 10,
    colors: [
        { color: "#FF0000", x: 20, y: 20 },
        { color: "#00FF00", x: 80, y: 20 },
        { color: "#0000FF", x: 50, y: 80 },
    ],
    animate: false,
}

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
