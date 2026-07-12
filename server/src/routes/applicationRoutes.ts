import express from 'express'

const router = express.Router()

router.get('/', async (req, res) => {
  res.json([
    {
      company: 'Amazon',
      role: 'SDE Intern',
      status: 'Interview'
    }
  ])
})

export default router