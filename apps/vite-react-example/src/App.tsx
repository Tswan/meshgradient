import { useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import './App.css'
import React from "react";
import MeshGradient from "mesh-gradient"; // or "@your-scope/mesh-gradient"


function App() {
  const [count, setCount] = useState(0)

  return (
    <>
      <div style={{ width: 400, height: 400 }}>
        <MeshGradient
          baseColor="#fff"
          noise={10}
          colors={[
            { color: "rgb(255,0,0)", x: 0, y: 0, radius: 10 },
            { color: "rgb(0,255,0)", x: 80, y: 20, radius: 10 },
            { color: "rgb(0,0,255)", x: 50, y: 50, radius: 10 },
          ]}
          animate={true}
          style={{ width: "100%", height: "100%" }}
        />
      </div>
    </>
  )
}

export default App
