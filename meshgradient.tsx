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
                uniform vec4 u_colors[${Math.max(1, colors.length)}];
                uniform vec2 u_positions[${Math.max(1, colors.length)}];
                uniform float u_radius[${Math.max(1, colors.length)}];
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
                    u = fract(u) * 6.28318530718; // 2*pi
                    return vec2(cos(u), sin(u));
                }
                float grainNoise(vec2 uv) {
                    vec2 pixel = floor(uv * u_resolution); // lock to actual pixel grid
                    float hash = dot(pixel, vec2(12.9898, 78.233));
                    return fract(sin(hash) * 43758.5453123);
                }
                float bigGrainNoise(vec2 uv, float scale) {
                    vec2 blockUV = floor(uv * u_resolution / scale);
                    float hash = dot(blockUV + u_time * 0.02, vec2(127.1, 311.7));
                    return fract(sin(hash) * 43758.5453123);
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
                    vec2 rotated = vec2(
                        cosA * toUV.x + sinA * toUV.y,
                        -sinA * toUV.x + cosA * toUV.y
                    );

                    // Scale coordinates to create an ellipse
                    vec2 scaled = rotated / radii;

                    // Return the distance in elliptical space
                    return length(scaled);
                }


                void main() {
                    vec2 uv = gl_FragCoord.xy / u_resolution;
                    vec4 color = u_baseColor;
                    float noiseIntensity = u_noise;
                    vec2 canvasCenter = vec2(0.5, 0.5);

                    for (int i = 0; i < ${Math.max(1, colors.length)}; i++) {
                        vec2 position = u_positions[i];
                        vec4 gradientColor = u_colors[i];
                        float radius = u_radius[i];

                        // Calculate the angle pointing towards the center
                        vec2 toCenter = canvasCenter - position;
                        toCenter.y = -toCenter.y;
                        float angle = atan(toCenter.x, toCenter.y);

                        // Gaussian weights for blending with elliptical distortion
                        for (float dx = -2.0; dx <= 2.0; dx++) {
                            for (float dy = -2.0; dy <= 2.0; dy++) {
                                // float grain = bigGrainNoise(uv * noiseIntensity, 40.0);
                                // vec2 samplePos = position + vec2(dx, dy) * 0.005 + (grain - 0.5) * 0.02;
                                float noise = psrdnoise(uv * noiseIntensity, vec2(10.0, 10.0), 0.0).x;
                                vec2 samplePos = position + vec2(dx, dy) * 0.005 + vec2(noise) * 0.01;

                                vec2 radii = vec2(
                                    radius, radius
                                );

                                float eDist = ellipticalDistance(uv, samplePos, radii, angle);
                                float dist;
                                if (eDist > 0.0) {
                                    dist = eDist;
                                } else {
                                    dist = distance(uv, position);
                                }

                                // float dist = distance(uv, position);
                                float weight = 1.0 - smoothstep(0.001, 0.5, dist);
                                color = mix(color, blendAverage(color, gradientColor), weight * 0.1);
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

            const uBaseColor = parseColorString(baseColor)

            // Parse gradient colors
            const colorArray = colors.map((c) => {
                const rgba = parseColorString(c.color)
                return [rgba.r / 255, rgba.g / 255, rgba.b / 255, rgba.a]
            })
            const flattenedColors = colorArray.flat()

            // Animate positions over time
            const positions = colors.map((c, i) => {
                const offset = !animate ? 0 : Math.sin(time * 0.001 + i) * 0.1 // Add oscillation
                return [c.x / 100 + offset, 1 - c.y / 100 + offset]
            })
            const flattenedPositions = positions.flat()

            const radii = colors.map((c) => {
                return c.radius / 10
            })
            const flattenedRadii = radii.flat()

            const uniforms = {
                u_resolution: [gl.canvas.width, gl.canvas.height],
                u_baseColor: [
                    uBaseColor.r / 255,
                    uBaseColor.g / 255,
                    uBaseColor.b / 255,
                    uBaseColor.a,
                ],
                u_noise: noise,
                u_colors: new Float32Array(flattenedColors),
                u_positions: new Float32Array(flattenedPositions),
                u_radius: new Float32Array(flattenedRadii),
                u_time: animate ? time * 0.001 : 1,
            }

            gl.useProgram(programInfo.program)
            setBuffersAndAttributes(gl, programInfo, bufferInfo)
            setUniforms(programInfo, uniforms)
            drawBufferInfo(gl, bufferInfo)
            const pixels = new Uint8Array(
                gl.canvas.width * gl.canvas.height * 4
            )

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

function hexToRgba(hex) {
    // Remove '#' if present
    hex = hex.replace(/^#/, "")

    // Parse RGB values
    let r,
        g,
        b,
        a = 255 // Default alpha to 255 (fully opaque)

    if (hex.length === 3 || hex.length === 4) {
        // Shorthand hex format (#RGB or #RGBA)
        r = parseInt(hex[0] + hex[0], 16)
        g = parseInt(hex[1] + hex[1], 16)
        b = parseInt(hex[2] + hex[2], 16)
        if (hex.length === 4) {
            a = parseInt(hex[3] + hex[3], 16)
        }
    } else if (hex.length === 6 || hex.length === 8) {
        // Full hex format (#RRGGBB or #RRGGBBAA)
        r = parseInt(hex.substring(0, 2), 16)
        g = parseInt(hex.substring(2, 4), 16)
        b = parseInt(hex.substring(4, 6), 16)
        if (hex.length === 8) {
            a = parseInt(hex.substring(6, 8), 16)
        }
    } else {
        console.error(`Invalid HEX color: ${hex}`)
        return { r: 0, g: 0, b: 0, a: 1 }
    }

    // Convert alpha from 0-255 to 0-1 range
    return { r, g, b, a: a / 255 }
}

function parseColorString(colorString) {
    if (colorString.startsWith("#")) {
        // Hex color
        let hex = colorString.replace("#", "")
        if (hex.length === 3) {
            hex = hex
                .split("")
                .map((c) => c + c)
                .join("") // expand short hex
        }
        if (hex.length !== 6) {
            console.error(`Invalid hex color string: ${colorString}`)
            return { r: 0, g: 0, b: 0, a: 1 }
        }
        const r = parseInt(hex.slice(0, 2), 16)
        const g = parseInt(hex.slice(2, 4), 16)
        const b = parseInt(hex.slice(4, 6), 16)
        return { r, g, b, a: 1 }
    } else {
        // rgb or rgba
        const match = colorString.match(
            /rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([01](?:\.\d+)?))?\)/
        )
        if (!match) {
            console.error(`Invalid color string: ${colorString}`)
            return { r: 0, g: 0, b: 0, a: 1 }
        }
        return {
            r: parseInt(match[1], 10),
            g: parseInt(match[2], 10),
            b: parseInt(match[3], 10),
            a: match[4] !== undefined ? parseFloat(match[4]) : 1,
        }
    }
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
