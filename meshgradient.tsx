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

        // Initialize MiniGl
        const gl = canvas.getContext("webgl")
        if (!gl) {
            console.error("WebGL not supported.")
            return
        }
        if (gl) {
            console.log("we got GL")
        }

        const miniGl = new MiniGl(gl)
        miniGl.initShaders()
        miniGl.setColors(baseColor, colors)

        const render = () => {
            miniGl.render()
            requestAnimationFrame(render)
        }
        render()

        const handleResize = () => {
            miniGl.resize(canvas)
        }
        handleResize() // Initial resize
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
                // backgroundColor: "blue",
                display: "block",
            }}
        />
    )
}

// MiniGl class embedded directly in the file
class MiniGl {
    constructor(gl) {
        this.gl = gl
        this.program = null
        this.uniforms = {}
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
            uniform float u_time;
            uniform vec2 u_resolution;
            uniform vec3 u_colors[5];

            void main() {
                vec2 uv = gl_FragCoord.xy / u_resolution;
                vec3 color = vec3(0.0);

                for (int i = 0; i < 5; i++) {
                    float dist = distance(uv, vec2(float(i) / 5.0, float(i) / 5.0));
                    color += u_colors[i] * (1.0 - smoothstep(0.2, 0.5, dist));
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
            time: this.gl.getUniformLocation(this.program, "u_time"),
            resolution: this.gl.getUniformLocation(
                this.program,
                "u_resolution"
            ),
            colors: this.gl.getUniformLocation(this.program, "u_colors"),
        }

        // Set up a full-screen quad
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
        this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null)

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
        const rgbBase = hexToRgb(baseColor)
        const colorArray = colors.map((color) => {
            const rgb = hexToRgb(color.color)
            return [rgb.r / 255, rgb.g / 255, rgb.b / 255]
        })

        const fullColorArray = [
            [rgbBase.r / 255, rgbBase.g / 255, rgbBase.b / 255],
            ...colorArray.slice(0, 4), // Support up to 5 colors max
        ]

        while (fullColorArray.length < 5) {
            fullColorArray.push([0, 0, 0]) // Fill remaining with black
        }

        const flattenedColors = fullColorArray.flat()
        this.gl.uniform3fv(
            this.uniforms.colors,
            new Float32Array(flattenedColors)
        )
    }

    resize(canvas) {
        const ratio = window.devicePixelRatio || 1
        canvas.width = canvas.clientWidth * ratio
        canvas.height = canvas.clientHeight * ratio
        this.gl.viewport(
            0,
            0,
            this.gl.drawingBufferWidth,
            this.gl.drawingBufferHeight
        )
    }

    render() {
        const time = performance.now() / 1000

        this.gl.clearColor(0.0, 0.0, 0.0, 0.0)
        this.gl.clear(this.gl.COLOR_BUFFER_BIT)
        this.gl.uniform1f(this.uniforms.time, time)
        this.gl.uniform2f(
            this.uniforms.resolution,
            this.gl.drawingBufferWidth,
            this.gl.drawingBufferHeight
        )

        this.gl.drawArrays(this.gl.TRIANGLES, 0, 6) // Draw the quad
    }

    dispose() {
        this.gl.deleteProgram(this.program)
        this.gl.deleteBuffer(this.vertexBuffer)
    }
}

// Utility: Convert hex color to RGB
function hexToRgb(hex) {
    const bigint = parseInt(hex.replace("#", ""), 16)
    const r = (bigint >> 16) & 255
    const g = (bigint >> 8) & 255
    const b = bigint & 255
    return { r, g, b }
}

MeshGradient.defaultProps = {
    baseColor: "#FFFFFF",
    colors: [
        { color: "#FF0000", x: 40, y: 20 },
        { color: "#00FF00", x: 80, y: 0 },
        { color: "#0000FF", x: 22, y: 37 },
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
        defaultValue: [
            { color: "#FF0000", x: 40, y: 20 },
            { color: "#00FF00", x: 80, y: 0 },
            { color: "#0000FF", x: 22, y: 37 },
        ],
    },
})
