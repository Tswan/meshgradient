import { useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import './App.css'
import React from "react";
import MeshGradient, {NoiseType} from "mesh-gradient";


function App() {
  const [count, setCount] = useState(0)
  const [baseColor, setBaseColor] = useState("#fff")
  const [colors, setColors] = useState([
    { color: "rgb(255,0,0)", x: 0, y: 0, radius: 10 },
    { color: "rgb(0,255,0)", x: 80, y: 20, radius: 10 },
    { color: "rgb(0,0,255)", x: 50, y: 50, radius: 10 },
  ]);

  const getRandomColor = () => {
    const r = Math.floor(Math.random() * 256);
    const g = Math.floor(Math.random() * 256);
    const b = Math.floor(Math.random() * 256);
    return `rgb(${r},${g},${b})`;
  };

  const getRandomHexColor = () => {
    const r = Math.floor(Math.random() * 256);
    const g = Math.floor(Math.random() * 256);
    const b = Math.floor(Math.random() * 256);
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
  };

  const randomizeBaseColor = () => {
    setBaseColor(getRandomHexColor());
  };

  const randomizeColors = () => {
    setColors(prevColors => 
      prevColors.map(colorObj => ({
        ...colorObj,
        color: getRandomColor()
      }))
    );
  };

  const randomizePositions = () => {
    setColors(prevColors => 
      prevColors.map(colorObj => ({
        ...colorObj,
        x: Math.floor(Math.random() * 100),
        y: Math.floor(Math.random() * 100)
      }))
    );
  };

  const randomizeRadius = () => {
    setColors(prevColors => 
      prevColors.map(colorObj => ({
        ...colorObj,
        radius: Math.floor(Math.random() * 30) + 5 // 5-35 range
      }))
    );
  };

  const randomizeAll = () => {
    setColors(prevColors => 
      prevColors.map(() => ({
        color: getRandomColor(),
        x: Math.floor(Math.random() * 100),
        y: Math.floor(Math.random() * 100),
        radius: Math.floor(Math.random() * 30) + 5
      }))
    );
  };

  return (
    <>
      <div style={{ marginBottom: 20 }}>
        <button onClick={randomizeColors} style={{ marginRight: 10 }}>
          Randomize Colors
        </button>
        <button onClick={randomizePositions} style={{ marginRight: 10 }}>
          Randomize Positions
        </button>
        <button onClick={randomizeRadius} style={{ marginRight: 10 }}>
          Randomize Radius
        </button>
        <button onClick={randomizeBaseColor} style={{ marginRight: 10 }}>
          Randomize Base Color
        </button>
        <button onClick={randomizeAll}>
          Randomize All
        </button>
      </div>
      <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
        <div style={{ width: 400, height: 400 }}>
          <MeshGradient
            baseColor={baseColor}
            noiseType={NoiseType.PERLIN}
            noise={96}
            noiseIntensity={2}
            colors={colors}
            animate={true}
            style={{ width: "100%", height: "100%" }}
          />
        </div>
        <div style={{ 
          padding: 20, 
          border: '1px solid #ccc', 
          borderRadius: 8, 
          backgroundColor: '#f9f9f9',
          minWidth: 300
        }}>
          <h3 style={{ margin: '0 0 15px 0', fontSize: 18 }}>Gradient Configuration</h3>
          
          <div style={{ marginBottom: 15 }}>
            <strong>Base Color:</strong>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 5 }}>
              <div style={{ 
                width: 30, 
                height: 30, 
                backgroundColor: baseColor, 
                border: '1px solid #000',
                borderRadius: 4
              }}></div>
              <span style={{ fontFamily: 'monospace' }}>{baseColor}</span>
            </div>
          </div>

          <div>
            <strong>Color Points:</strong>
            {colors.map((colorObj, index) => (
              <div key={index} style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: 10, 
                marginTop: 8,
                padding: 8,
                backgroundColor: '#fff',
                borderRadius: 4,
                border: '1px solid #ddd'
              }}>
                <div style={{ 
                  width: 20, 
                  height: 20, 
                  backgroundColor: colorObj.color, 
                  border: '1px solid #000',
                  borderRadius: 2
                }}></div>
                <div style={{ fontSize: 12, fontFamily: 'monospace' }}>
                  <div>{colorObj.color}</div>
                  <div>x: {colorObj.x}%, y: {colorObj.y}%</div>
                  <div>radius: {colorObj.radius}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}

export default App
