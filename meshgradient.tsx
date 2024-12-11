import { addPropertyControls, ControlType } from "framer"
import { createStore } from "https://framer.com/m/framer/store.js@^1.0.0"
import React from "react"

/** @framerDisableUnlink
 * @framerSupportedLayoutWidth any
 * @framerSupportedLayoutHeight any
 */

const useStore = createStore({ showContent: false })

export default function MeshGradient(props) {
    const { baseColor, colors } = props

    // Generate the radial-gradient layers
    const gradients = colors.map((color, index) => {
        return `radial-gradient(at ${color.x}% ${color.y}%, ${color.color} 0px, transparent 50%)`
    })

    const gradientStyle = {
        width: "100%",
        height: "100%",
        backgroundColor: baseColor,
        backgroundImage: gradients.join(", "),
        backgroundSize: "cover",
    }

    return <div style={gradientStyle}></div>
}

MeshGradient.defaultProps = {
    baseColor: "#FFFFFF",
    colors: [
        // Default colors & points
        { color: "#FF0000", x: 40, y: 20 },
        { color: "#00FF00", x: 80, y: 0 },
        { color: "#0000FF", x: 22, y: 37 },
    ],
}

addPropertyControls(MeshGradient, {
    baseColor: {
        title: "Base Color",
        type: ControlType.Color,
        defaultValue: "#FF00AA",
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
            // Example default colors & points
            { color: "#FF0000", x: 40, y: 20 },
            { color: "#00FF00", x: 80, y: 0 },
            { color: "#0000FF", x: 22, y: 37 },
        ],
    },
})
