// src/MeshGradient.tsx

import React, { useRef, useEffect } from "react";
import chroma from "chroma-js";
import * as twgl from "twgl.js";

// Type definitions for the gradient color stops
export interface MeshGradientColor {
    color: string;
    x: number;
    y: number;
    radius: number;
}

export interface MeshGradientProps {
    baseColor?: string;
    noise?: number;
    colors?: MeshGradientColor[];
    animate?: boolean;
    style?: React.CSSProperties;
    className?: string;
}

/**
 * MeshGradient React component
 * Renders a mesh gradient using WebGL and TWGL.js
 */
const MeshGradient: React.FC<MeshGradientProps> = ({
    baseColor = "#FFFFFF",
    noise = 10,
    colors = [
        { color: "rgb(255,0,0)", x: 0, y: 0, radius: 10 },
        { color: "rgb(0,255,0)", x: 80, y: 20, radius: 10 },
        { color: "rgb(0,0,255)", x: 50, y: 50, radius: 10 },
    ],
    animate = false,
    style,
    className,
}) => {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const rafId = useRef<number | null>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const gl = canvas.getContext("webgl");
        if (!gl) {
            console.error("WebGL not supported.");
            return;
        }

        const vertexShaderSource = `attribute vec4 position; void main() { gl_Position = position; }`;
        const fragmentShaderSource = generateFragmentShader(colors.length);

        const programInfo = twgl.createProgramInfo(gl, [
            vertexShaderSource,
            fragmentShaderSource,
        ]);
        const arrays = {
            position: [
                -1, -1, 0, 1, -1, 0, -1, 1, 0, -1, 1, 0, 1, -1, 0, 1, 1, 0,
            ],
        };
        const bufferInfo = twgl.createBufferInfoFromArrays(gl, arrays);

        const u_positions = new Float32Array(colors.length * 2);
        const u_radius = new Float32Array(colors.length);

        const draw = (time: number) => {
            twgl.resizeCanvasToDisplaySize(gl.canvas as HTMLCanvasElement);
            gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

            const chromaColor = chroma(baseColor).gl();

            const uBaseColor = {
                r: chromaColor[0],
                g: chromaColor[1],
                b: chromaColor[2],
                a: chromaColor[3],
            };

            const colorArray = colors
                .map((c) => {
                    const rgba = chroma(c.color).gl();
                    return [rgba[0], rgba[1], rgba[2], rgba[3]];
                })
                .flat();

            for (let i = 0; i < colors.length; i++) {
                const offset = animate ? Math.sin(time * 0.001 + i) * 0.1 : 0;
                u_positions[i * 2] = colors[i].x / 100 + offset;
                u_positions[i * 2 + 1] = 1 - colors[i].y / 100 + offset;
                u_radius[i] = colors[i].radius / 10;
            }

            const positions = colors
                .map((c, i) => {
                    const offset = animate
                        ? Math.sin(time * 0.001 + i) * 0.1
                        : 0;
                    return [c.x / 100 + offset, 1 - c.y / 100 + offset];
                })
                .flat();

            const radii = colors.map((c) => c.radius / 10);

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
                u_positions: u_positions,
                u_radius: u_radius,
                u_time: animate ? time * 0.001 : 1,
            };

            gl.useProgram(programInfo.program);
            twgl.setBuffersAndAttributes(gl, programInfo, bufferInfo);
            twgl.setUniforms(programInfo, uniforms);
            twgl.drawBufferInfo(gl, bufferInfo);

            if (animate) rafId.current = requestAnimationFrame(draw);
        };

        draw(0); // Render once or start animating

        return () => {
            if (rafId.current) cancelAnimationFrame(rafId.current);
        };
    }, [baseColor, noise, animate, JSON.stringify(colors)]);

    return (
        <canvas
            ref={canvasRef}
            style={{
                width: "100%",
                height: "100%",
                display: "block",
                ...style,
            }}
            className={className}
        />
    );
};

export default MeshGradient;

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

        // Simple hash function for pseudo-random numbers
        float hash(vec2 p) {
            vec3 p3 = fract(vec3(p.xyx) * 0.1031);
            p3 += dot(p3, p3.yzx + 19.19);
            return fract((p3.x + p3.y) * p3.z);
        }

        float hash2D(vec2 p) {
            // a better decorrelated hash
            return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
        }
        
        // Grainy noise function - produces random, pixelated noise
        float grainNoise(vec2 pos, float scale) {
            vec2 i = floor(pos * scale);
            return hash(i) * 2.0 - 1.0; // Output range: -1 to 1
        }
        
        // Multi-octave grainy noise for more interesting patterns
        float grainNoiseOctaves(vec2 pos, float scale, int octaves) {
            float noise = 0.0;
            float amplitude = 1.0;
            float frequency = scale;
            float maxValue = 0.0;
            
            for (int i = 0; i < 4; i++) {
                if (i >= octaves) break;
                noise += grainNoise(pos, frequency) * amplitude;
                maxValue += amplitude;
                amplitude *= 0.5;
                frequency *= 2.0; //20.0;
            }
            
            return noise / maxValue;
        }

        float bigGrainNoise(vec2 uv, float scale) {
            vec2 blockUV = floor(uv * u_resolution / scale);

            // Add some motion to UV so grains "wobble" instead of just flicker
            vec2 animatedUV = blockUV + vec2(
                sin(u_time * 0.7),
                cos(u_time * 1.3)
            ) * 0.5;

            float n = fract(sin(dot(animatedUV, vec2(127.1, 311.7)) + u_time * 20.0) * 43758.5453);

            return step(0.5, n);
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
                        // float noise = grainNoiseOctaves(uv, u_noise, 100);
                        
                        vec2 samplePos = position + vec2(dx, dy) * 0.005;
                        float eDist = ellipticalDistance(uv, samplePos, vec2(radius), angle);
                        float dist = eDist > 0.0 ? eDist : distance(uv, position);
                        float weight = 1.0 - smoothstep(0.001, 0.5, dist);
                        color = mix(color, blendAverage(color, gradientColor), weight * 0.1);
                    }
                }
            }
            float noise = bigGrainNoise(uv, u_noise);
            color.rgb += (noise - 0.5) * 0.1; 
            gl_FragColor = color;
        }
    `;
}
