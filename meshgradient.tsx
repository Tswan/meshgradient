import { addPropertyControls, ControlType } from "framer"
import React, { useRef, useEffect } from "react"

/** @framerDisableUnlink
 * @framerSupportedLayoutWidth any
 * @framerSupportedLayoutHeight any
 */

export default function MeshGradient(props) {
    const { baseColor, colors } = props
    const canvasRef = useRef(null)

    useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas) return

        const gl = canvas.getContext("webgl")
        if (!gl) {
            console.error("WebGL not supported.")
            return
        }

        const miniGl = new MiniGl(gl)
        miniGl.initShaders()
        miniGl.setColors(baseColor, colors)

        const render = () => {
            miniGl.render(baseColor)
            requestAnimationFrame(render)
        }
        render()

        const handleResize = () => {
            miniGl.resize(canvas)
        }
        handleResize()
        window.addEventListener("resize", handleResize)

        return () => {
            window.removeEventListener("resize", handleResize)
            miniGl.dispose()
        }
    }, [baseColor, colors])

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

class MiniGl {
    constructor(gl) {
        this.gl = gl
        this.program = null
        this.uniforms = null
        this.vertexBuffer = null
    }

    initShaders() {
        const vertexShaderSource = `
            attribute vec2 a_position;

            void main() {
                gl_Position = vec4(a_position, 0.0, 1.0);
            }
        `

        const fragmentShaderSource = `
            precision mediump float;

            uniform vec2 u_resolution;
            uniform vec3 u_colors[5];
            uniform vec2 u_positions[5];

            void main() {
                vec2 uv = gl_FragCoord.xy / u_resolution; // Normalize UV coordinates
                vec3 color = vec3(0.0);

                // Blend colors based on distance to defined positions
                for (int i = 0; i < 5; i++) {
                    float dist = distance(uv, u_positions[i]);
                    color += u_colors[i] * (1.0 - smoothstep(0.1, 0.5, dist));
                }

                gl_FragColor = vec4(color, 1.0);
            }
        `

        const vertexShader = this.createShader(
            this.gl.VERTEX_SHADER,
            vertexShaderSource
        )
        const fragmentShader = this.createShader(
            this.gl.FRAGMENT_SHADER,
            fragmentShaderSource
        )
        this.program = this.createProgram(vertexShader, fragmentShader)

        this.uniforms = {
            resolution: this.gl.getUniformLocation(
                this.program,
                "u_resolution"
            ),
            colors: this.gl.getUniformLocation(this.program, "u_colors"),
            positions: this.gl.getUniformLocation(this.program, "u_positions"),
        }

        // Full-screen quad
        const vertices = new Float32Array([
            -1,
            -1, // Bottom-left
            1,
            -1, // Bottom-right
            -1,
            1, // Top-left
            -1,
            1, // Top-left
            1,
            -1, // Bottom-right
            1,
            1, // Top-right
        ])

        this.vertexBuffer = this.gl.createBuffer()
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.vertexBuffer)
        this.gl.bufferData(this.gl.ARRAY_BUFFER, vertices, this.gl.STATIC_DRAW)

        const positionLocation = this.gl.getAttribLocation(
            this.program,
            "a_position"
        )
        this.gl.enableVertexAttribArray(positionLocation)
        this.gl.vertexAttribPointer(
            positionLocation,
            2,
            this.gl.FLOAT,
            false,
            0,
            0
        )
    }

    createShader(type, source) {
        const shader = this.gl.createShader(type)
        this.gl.shaderSource(shader, source)
        this.gl.compileShader(shader)
        if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
            console.error(this.gl.getShaderInfoLog(shader))
            this.gl.deleteShader(shader)
            return null
        }
        return shader
    }

    createProgram(vertexShader, fragmentShader) {
        const program = this.gl.createProgram()
        this.gl.attachShader(program, vertexShader)
        this.gl.attachShader(program, fragmentShader)
        this.gl.linkProgram(program)
        if (!this.gl.getProgramParameter(program, this.gl.LINK_STATUS)) {
            console.error(this.gl.getProgramInfoLog(program))
            this.gl.deleteProgram(program)
            return null
        }
        this.gl.useProgram(program)
        return program
    }

    setColors(baseColor, colors) {
        this.gl.useProgram(this.program)
        // Colors
        const colorArray = colors.map((c) => {
            const rgb = parseRgbString(c.color)
            return [rgb.r / 255, rgb.g / 255, rgb.b / 255]
        })
        const fullColors = [
            ...colorArray,
            [1, 0, 0],
            [0, 1, 0],
            [0, 0, 1],
            [1, 1, 0],
            [1, 0, 1],
        ].slice(0, 5)
        const flattenedColors = fullColors.flat()
        this.gl.uniform3fv(
            this.uniforms.colors,
            new Float32Array(flattenedColors)
        )

        // Positions
        const positions = colors.map((c) => [c.x / 100, 1 - c.y / 100])
        const fullPositions = [
            ...positions,
            [0.5, 0.5],
            [0.25, 0.25],
            [0.75, 0.75],
            [0.5, 0.75],
        ].slice(0, 5)
        const flattenedPositions = fullPositions.flat()
        this.gl.uniform2fv(
            this.uniforms.positions,
            new Float32Array(flattenedPositions)
        )
    }

    resize(canvas) {
        const ratio = window.devicePixelRatio || 1
        canvas.width = canvas.clientWidth * ratio
        canvas.height = canvas.clientHeight * ratio
        this.gl.viewport(0, 0, canvas.width, canvas.height)
    }

    render(baseColor) {
        this.gl.useProgram(this.program)

        // Parse baseColor into RGB and normalize
        const { r, g, b } = parseRgbString(baseColor) // Assuming `baseColor` is "rgb(r, g, b)"
        this.gl.clearColor(r / 255, g / 255, b / 255, 1.0) // Set the clear color based on `baseColor`

        this.gl.clear(this.gl.COLOR_BUFFER_BIT)

        // Set resolution uniform
        this.gl.uniform2f(
            this.uniforms.resolution,
            this.gl.drawingBufferWidth,
            this.gl.drawingBufferHeight
        )

        // Draw the full-screen quad
        this.gl.drawArrays(this.gl.TRIANGLES, 0, 6)
    }

    dispose() {
        this.gl.deleteProgram(this.program)
        this.gl.deleteBuffer(this.vertexBuffer)
    }
}

// Utility: Read the RGB color value
function parseRgbString(rgbString) {
    const match = rgbString.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/)
    if (!match) {
        console.error(`Invalid RGB string: ${rgbString}`)
        return { r: 0, g: 0, b: 0 } // Default to black if parsing fails
    }

    return {
        r: parseInt(match[1], 10), // Red component
        g: parseInt(match[2], 10), // Green component
        b: parseInt(match[3], 10), // Blue component
    }
}

MeshGradient.defaultProps = {
    baseColor: "#FFFFFF",
    colors: [
        { color: "#FF0000", x: 20, y: 20 },
        { color: "#00FF00", x: 80, y: 20 },
        { color: "#0000FF", x: 50, y: 80 },
    ],
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
})
