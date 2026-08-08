const pyramid= {

     vs : [
        // Spitze
        {x: 0,    y: 1,   z: 0},     //0

        // Boden vorne
        {x:-1, y:-1, z: 1},          //1
        {x: 1, y:-1, z: 1},           //2

        // Boden hinten
        {x: 1, y:-1, z:-1},           //3
        {x:-1, y:-1, z:-1},           //4
    ],
     fs : [
        // Seitenflächen
        [0,1,2],
        [0,2,3],
        [0,3,4],
        [0,4,1],

        // Boden
        [1,4,3,2],
    ]

}

export default pyramid;