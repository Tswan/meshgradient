import { addPropertyControls, ControlType } from "framer"
import React, { useRef, useEffect } from "react"
import MeshGradient from "mesh-gradient"

/** @framerDisableUnlink
 * @framerSupportedLayoutWidth any-prefer-fixed
 * @framerSupportedLayoutHeight any-prefer-fixed
 * @framerIntrinsicWidth 200
 * @framerIntrinsicHeight 200
 */

export default function MeshGradientComponent(props) {
    const { baseColor, noise, animate } = props
    const colors =
        props.colors.length !== 0
            ? props.colors
            : [
                  { color: "rgb(255,0,0)", x: 0, y: 0, radius: 10 },
                  { color: "rgb(0,255,0)", x: 80, y: 20, radius: 10 },
                  { color: "rgb(0,0,255)", x: 50, y: 50, radius: 10 },
              ]

    return (
        <MeshGradient
            style={{ width: "100%", height: "100%", display: "block" }}
            baseColor={baseColor}
            noise={noise}
            colors={colors}
            animate={animate}
        />
    )
}

// ---------- Framer controls ----------
addPropertyControls(MeshGradientComponent, {
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

MeshGradientComponent.defaultProps = {
    baseColor: "#FFFFFF",
    noise: 10,
    colors: [
        { color: "rgb(255,0,0)", x: 0, y: 0, radius: 10 },
        { color: "rgb(0,255,0)", x: 80, y: 20, radius: 10 },
        { color: "rgb(0,0,255)", x: 50, y: 50, radius: 10 },
    ],
    animate: false,
}
