interface ITransformer {
  id: number
  name: string
}
let a
let interfaceData: ITransformer

function testMethod (id: number, name: string) {
  console.log(JSON.stringify({ a, id, name, interfaceData }))
}

testMethod(10, 'username')
