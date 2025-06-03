const notFoundHandler = (req, res, next) => {
  // Cegah error untuk permintaan favicon.ico
  if (req.originalUrl === '/favicon.ico') {
    return res.status(204).end();
  }

  // not found route
  const error = new Error(`Tidak Ditemukan - ${req.originalUrl}`);
  res.status(404);
  next(error);
};

module.exports = { notFoundHandler };
