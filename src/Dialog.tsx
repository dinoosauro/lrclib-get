import { ReactNode, useEffect, useRef } from "react"

interface Props {
    /**
     * The content of the dialog
     */
    children: ReactNode,
    /**
     * The function used to close the Dialog
     */
    close: () => void,
    /**
     * Custom text to show instead of the "Close" button
     */
    customCloseText?: string
}
/**
 * Show a dialog
 * @returns the dialog ReactNode
 */
export default function Dialog({ children, close, customCloseText }: Props) {
    useEffect(() => {
        setTimeout(() => {
            if (ref.current) ref.current.style.opacity = "1";
        }, 25);
    }, [])
    const ref = useRef<HTMLDivElement>(null);
    return <>
        <div className="dialogContainer" ref={ref}>
            <div>
                {children}<br></br><br></br>
                <button onClick={() => {
                    if (ref.current) ref.current.style.opacity = "0";
                    setTimeout(close, 210);
                }}>{customCloseText ?? "Close"}</button>
            </div>
        </div>
    </>
}