try {
  await import('@qvac/rag')
  console.log(`${process.version}: @qvac/rag imports`)
} catch (err) {
  console.log(`${process.version}: ${err.code}`)
}
