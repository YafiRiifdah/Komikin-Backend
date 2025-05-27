const notFoundHandler = (req, res, next) => {
  const error = new Error(`Tidak Ditemukan - ${req.originalUrl}`);
  res.status(404);
  next(error); // Meneruskan error ke errorHandler utama
};

module.exports = { notFoundHandler };
