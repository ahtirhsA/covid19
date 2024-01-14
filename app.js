const express = require('express')
const app = express()
app.use(express.json())

const {open} = require('sqlite')
const sqlite3 = require('sqlite3')

const path = require('path')
const dbpath = path.join(__dirname, 'covid19IndiaPortal.db')
let db = null

const bcrypt = require('bcrypt')

const jwt = require('jsonwebtoken')

const connectionWithServer = async () => {
  try {
    db = await open({
      filename: dbpath,
      driver: sqlite3.Database,
    })
    app.listen(3000, () => {
      console.log('Server Running at http://localhost:3000')
    })
  } catch (e) {
    console.log(`The Error Message is ${e}`)
    process.exit(1)
  }
}

connectionWithServer()

//Login

app.post('/login/', async (request, response) => {
  const {username, password} = request.body
  const userCheck = `
      SELECT * FROM user WHERE username='${username}';
    `
  const userRes = await db.get(userCheck)
  if (userRes !== undefined) {
    const comparePassword = await bcrypt.compare(password, userRes.password)
    if (comparePassword === true) {
      const payload = {username: username}
      const jwt_token = jwt.sign(payload, 'MY_LOGIN_KEY')
      response.send({jwt_token})
    } else {
      response.status(400)
      response.send('Invalid password')
    }
  } else {
    response.status(400)
    response.send('Invalid user')
  }
})

//MIDDLEWEAR

const authentication = (request, response, next) => {
  const authHeader = request.headers['authorization']
  let jwtToken
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(' ')[1]
  }
  if (jwtToken === undefined) {
    response.status(401)
    response.send('Invalid JWT Token')
  } else {
    jwt.verify(jwtToken, 'MY_LOGIN_KEY', async (error, payload) => {
      if (error) {
        response.status(401)
        response.send('Invalid JWT Token')
      } else {
        next()
      }
    })
  }
}

app.get('/states/', authentication, async (request, response) => {
  const getStates = `
    SELECT * FROM state;
  `
  const resQuery = await db.all(getStates)
  response.send(
    resQuery.map(i => ({
      stateId: i.state_id,
      stateName: i.state_name,
      population: i.population,
    })),
  )
})

//API 2

app.get('/states/:stateId/', authentication, async (request, response) => {
  const {stateId} = request.params
  const specState = `
    SELECT * FROM state WHERE state_id=${stateId};
  `
  const resQuery = await db.get(specState)
  response.send({
    stateId: resQuery.state_id,
    stateName: resQuery.state_name,
    population: resQuery.population,
  })
})

// API 3

app.post('/districts/', authentication, async (request, response) => {
  const reqBdy = request.body
  const {districtName, stateId, cases, cured, active, deaths} = reqBdy
  const insrtRow = `
     INSERT INTO district(
      district_name ,state_id ,cases ,cured ,active , deaths )
      VALUES('${districtName}',${stateId},${cases},${cured},${active},${deaths});
  `
  const resCreated = await db.run(insrtRow)
  response.send(`District Successfully Added`)
})

//API 4

app.get(
  '/districts/:districtId/',
  authentication,
  async (request, response) => {
    const {districtId} = request.params
    const specDistrict = `
     SELECT * FROM district WHERE district_id=${districtId};
  `
    const resSpecDistrict = await db.get(specDistrict)
    response.send({
      districtId: resSpecDistrict.district_id,
      districtName: resSpecDistrict.district_name,
      stateId: resSpecDistrict.state_id,
      cases: resSpecDistrict.cases,
      cured: resSpecDistrict.cured,
      active: resSpecDistrict.active,
      deaths: resSpecDistrict.deaths,
    })
  },
)

//API 5

app.delete(
  '/districts/:districtId/',
  authentication,
  async (request, response) => {
    const {districtId} = request.params
    const delQuery = `
     DELETE FROM district WHERE district_id=${districtId};
  `
    const resDelDistrict = await db.run(delQuery)
    response.send('District Removed')
  },
)

//API 6

app.put('/districts/:districtId', authentication, async (request, response) => {
  const {districtId} = request.params
  const requBdy = request.body
  const {districtName, stateId, cases, cured, active, deaths} = requBdy
  const updtRow = `
     UPDATE district SET 
      district_name='${districtName}',
      state_id=${stateId},
      cases=${cases},
      cured=${cured},
      active=${active},
      deaths=${deaths}
    WHERE district_id=${districtId};
  `
  const resUpdate = await db.run(updtRow)
  response.send(`District Details Updated`)
})

//API 7

app.get(
  '/states/:stateId/stats/',
  authentication,
  async (request, response) => {
    const {stateId} = request.params
    const specStats = `
     SELECT 
      SUM(district.cases) AS totalCases,
      SUM(district.cured) AS totalCured,
      SUM(district.active) AS totalActive,
      SUM(district.deaths) AS totalDeaths
      FROM state JOIN district ON state.state_id=district.state_id
      WHERE state.state_id=${stateId};
  `
    const resCount = await db.get(specStats)
    response.send(resCount)
  },
)

module.exports = app
