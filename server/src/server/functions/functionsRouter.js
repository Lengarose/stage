const express = require('express');

function createFunctionsRouter(handlers) {
  const router = express.Router();

  router.post('/:name', async (req, res) => {
    const { name } = req.params;
    const handler = handlers[name];
    if (!handler) return res.status(404).json({ error: `Function '${name}' not found` });

    try {
      const params = { ...req.body, _auth_user_id: req.user?.id };
      const result = await handler(params);
      res.json(result);
    } catch (err) {
      const status = Number(err?.status) >= 400 && Number(err?.status) < 600
        ? Number(err.status)
        : 500;
      const payload = { error: err.message };
      if (err?.code) payload.code = String(err.code);
      res.status(status).json(payload);
    }
  });

  return router;
}

module.exports = { createFunctionsRouter };
