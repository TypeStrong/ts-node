interface ITransformer {
  id: number
  name: string
}
let interfaceData: ITransformer

function testMethod (id: number, name: string) {
  console.log(JSON.stringify({ id, name, interfaceData }))
}

testMethod(10, 'username')
