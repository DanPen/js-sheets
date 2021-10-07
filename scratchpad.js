peteer = require('puppeteer');

// Custom fetch to avoid CORS issues.
const customFetch = (url, ...otherArgs) => {
	return new Promise( async (resolve, reject) => {
		var urlParsed = url
		if (typeof url === 'string') {
			urlParsed = new URL(url)
		}

		const browser = await puppeteer.launch({ headless: false, slowMo: 2000 })
		const page = await browser.newPage()
		await page.goto(urlParsed.origin)

		const returnToElectron = (response) => {
			console.log(response)
			resolve(response)
			browser.close()
		}

		await page.exposeFunction('returnToElectron', returnToElectron)

		page.evaluate( (urlParsed, otherArgs) => {
			const fetchResponse = fetch(urlParsed, ...otherArgs)
			console.log(fetchResponse)
			returnToElectron(fetchResponse)
		}, urlParsed, otherArgs)
	})
}

customFetch('http://openinsider.com/latest-cluster-buys').then(response => {
	console.log(response)
})