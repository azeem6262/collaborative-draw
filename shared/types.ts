export interface Point{
    x: number;
    y: number;
}


export interface Stroke{                //line drawn by the user
    id: string;
    userId: string;
    points: Point[];
    color: string;
    lineWidth: number;
}


export interface User{
    id: string;
    name: string;
    color: string;
    cursor: Point
}