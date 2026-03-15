'use strict';
const express = require('express');
const router  = express.Router();

// GET /api/members/data  — example protected endpoint
router.get('/data', (req, res) => {
  // req.user is set by requireAuth middleware mounted in server.js
  res.json({
    ok: true,
    members: [
      { name: 'Anna Müller',  sport: 'Paddeln',          since: '2019' },
      { name: 'Ben Schmidt',  sport: 'Drachenboot',       since: '2021' },
      { name: 'Clara Wagner', sport: 'Stand-up Paddeln',  since: '2022' },
      { name: 'David Koch',   sport: 'Motorboot',         since: '2020' },
    ],
  });
});

module.exports = router;
