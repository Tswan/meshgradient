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
            miniGl.render()
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
        this.maxColors = 100 // Arbitrary maximum number of colors
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
            uniform vec3 u_baseColor; // Background color
            uniform vec3 u_colors[100]; // Arbitrary large number
            uniform vec2 u_positions[100];
            uniform int u_numColors;

            vec3 blendMultiply(vec3 base, vec3 blend) {
                return base * blend;
            }

            vec3 blendScreen(vec3 base, vec3 blend) {
                return 1.0 - (1.0 - base) * (1.0 - blend);
            }

            float blendOverlay(float base, float blend) {
                return base < 0.5 ? (2.0 * base * blend) : (1.0 - 2.0 * (1.0 - base) * (1.0 - blend));
            }

            vec3 blendOverlay(vec3 base, vec3 blend) {
                return vec3(
                    blendOverlay(base.r, blend.r),
                    blendOverlay(base.g, blend.g),
                    blendOverlay(base.b, blend.b)
                );
            }

            vec3 blendAverage(vec3 base, vec3 blend) {
                return (base+blend)/2.0;
            }



            void main() {
                vec2 uv = gl_FragCoord.xy / u_resolution; // Normalize UV coordinates
                vec3 color = u_baseColor; // Start with the base color

                // Blend colors based on distance to defined positions
                for (int i = 0; i < 100; i++) { // Fixed loop size
                    if (i >= u_numColors) break; // Use dynamic control via break

                    float dist = distance(uv, u_positions[i]);
                    float weight = 1.0 - smoothstep(0.1, 0.5, dist); // Weight based on distance
                    vec3 blendedColor = blendAverage(color, u_colors[i]); // Blend using Multiply
                    color = mix(color, blendedColor, weight); // Blend the colors based on weight
                }

                gl_FragColor = vec4(color, 1.0); // Output final color
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
            baseColor: this.gl.getUniformLocation(this.program, "u_baseColor"),
            colors: this.gl.getUniformLocation(this.program, "u_colors"),
            positions: this.gl.getUniformLocation(this.program, "u_positions"),
            numColors: this.gl.getUniformLocation(this.program, "u_numColors"),
        }

        const vertices = new Float32Array([
            -1,
            -1,
            1,
            -1,
            -1,
            1, // Triangle 1
            -1,
            1,
            1,
            -1,
            1,
            1, // Triangle 2
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

    setColors(baseColor, colors) {
        this.gl.useProgram(this.program)

        // Set the background color
        const { r, g, b } = parseRgbString(baseColor)
        this.gl.uniform3f(this.uniforms.baseColor, r / 255, g / 255, b / 255)

        // Set the gradient colors
        const colorArray = colors.map((c) => {
            const rgb = parseRgbString(c.color)
            return [rgb.r / 255, rgb.g / 255, rgb.b / 255]
        })

        const flattenedColors = colorArray.flat()
        this.gl.uniform3fv(
            this.uniforms.colors,
            new Float32Array(flattenedColors)
        )

        // Set the positions
        const positions = colors.map((c) => [c.x / 100, 1 - c.y / 100])
        const flattenedPositions = positions.flat()
        this.gl.uniform2fv(
            this.uniforms.positions,
            new Float32Array(flattenedPositions)
        )

        // Set the number of colors
        this.gl.uniform1i(this.uniforms.numColors, colors.length)
    }

    resize(canvas) {
        const ratio = window.devicePixelRatio || 1
        canvas.width = canvas.clientWidth * ratio
        canvas.height = canvas.clientHeight * ratio
        this.gl.viewport(0, 0, canvas.width, canvas.height)
    }

    render() {
        this.gl.useProgram(this.program)

        this.gl.clear(this.gl.COLOR_BUFFER_BIT)

        this.gl.uniform2f(
            this.uniforms.resolution,
            this.gl.drawingBufferWidth,
            this.gl.drawingBufferHeight
        )

        this.gl.drawArrays(this.gl.TRIANGLES, 0, 6) // Full-screen quad
    }

    dispose() {
        this.gl.deleteProgram(this.program)
        this.gl.deleteBuffer(this.vertexBuffer)
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
}

// Utility: Parse RGB string
function parseRgbString(rgbString) {
    const match = rgbString.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/)
    if (!match) {
        console.error(`Invalid RGB string: ${rgbString}`)
        return { r: 0, g: 0, b: 0 }
    }

    return {
        r: parseInt(match[1], 10),
        g: parseInt(match[2], 10),
        b: parseInt(match[3], 10),
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
