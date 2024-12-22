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
    const { baseColor, colors, animate } = props

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
                uniform vec4 u_colors[${colors.length}];
                uniform vec2 u_positions[${colors.length}];

                // Simple pseudo-random function
                float random(vec2 st) {
                    return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
                }

                vec4 blendAverage(vec4 base, vec4 blend) {
                    return (base + blend) / 2.0;
                }

                void main() {
                    vec2 uv = gl_FragCoord.xy / u_resolution;
                    vec4 color = u_baseColor;

                    for (int i = 0; i < ${colors.length}; i++) {
                        vec2 position = u_positions[i];
                        vec4 gradientColor = u_colors[i];

                        // Gaussian weights for blurring with added randomness
                        for (float dx = -2.0; dx <= 2.0; dx++) {
                            for (float dy = -2.0; dy <= 2.0; dy++) {
                                // Add randomness to the sampling position
                                float randX = random(uv + vec2(dx, dy)) * 0.02; // Adjust randomness scale
                                float randY = random(uv - vec2(dx, dy)) * 0.02;

                                vec2 samplePos = position + vec2(dx + randX, dy + randY) * 0.005; // Adjust blur radius
                                float dist = distance(uv, samplePos);
                                float weight = 1.0 - smoothstep(0.1, 0.5, dist);
                                color = mix(color, blendAverage(color, gradientColor), weight * 0.05);
                            }
                        }
                    }

                    gl_FragColor = color;
                }
            `

        const vertexShader = compileShader(
            gl,
            gl.VERTEX_SHADER,
            vertexShaderSource
        )
        const fragmentShader = compileShader(
            gl,
            gl.FRAGMENT_SHADER,
            fragmentShaderSource
        )

        function compileShader(gl, type, source) {
            const shader = gl.createShader(type)
            gl.shaderSource(shader, source)
            gl.compileShader(shader)
            if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
                console.error(
                    "Shader compile error:",
                    gl.getShaderInfoLog(shader)
                )
                return null
            }
            return shader
        }

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
