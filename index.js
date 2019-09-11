const { config, proxy } = require('internal')
const hls = require('./hls')

const defaults = {
	name: 'LodgeTV',
	prefix: 'lodgetv_',
	icon: 'https://4.bp.blogspot.com/-Eg90Vh8Redo/W1jD5cl7sVI/AAAAAAAADjQ/b0uHeL1gjkkwKvqjhS-X0LpLqzVgPqaaACLcBGAs/s1600/LodgeTV_Playlist.png',
	paginate: 100
}

hls.init({ prefix: defaults.prefix, type: 'tv', config })

const defaultTypes = [
	{
		name: 'LodgeTV English',
		logo: 'https://4.bp.blogspot.com/-eEawS9kjsfw/W3Ht71VbPCI/AAAAAAAADtM/h9egsD8VG8ssidwGC5KW6EzKoG9hirbswCLcBGAs/s1600/LTV-EN.png',
		m3u: 'https://pastebin.com/raw/2D80tRy5'
	},
	{
		name: 'LodgeTV Spanish',
		logo: 'https://2.bp.blogspot.com/-yF4f6_B06XQ/W3HuADwvglI/AAAAAAAADtQ/MZ9FHp6NQhYmSUdOsAlwIipp4D7eSb0JACLcBGAs/s1600/LTV-SP.png',
		m3u: 'https://pastebin.com/raw/WVyV87rg'
	},
	{
		name: 'LodgeTV Arabic',
		logo: 'https://4.bp.blogspot.com/-xJmz12n_78A/W3HuDdnelcI/AAAAAAAADtY/cuNi6tHX3U8frmMXfM1CRrADl2-wF5GXwCLcBGAs/s1600/LTV-AR.png',
		m3u: 'https://pastebin.com/raw/1BpnNp49'
	},
]

const types = []

for (let i = 0; defaultTypes[i]; i++)
	if (config['show_'+i])
		types.push(defaultTypes[i])

const catalogs = []

if (config.style == 'Catalogs')
	for (let i = 0; types[i]; i++)
		if (types[i].m3u)
			catalogs.push({
				name: types[i].name,
				id: defaults.prefix + 'cat_' + i,
				type: 'tv',
				extra: [ { name: 'search' }, { name: 'skip' } ]
			})

function btoa(str) {
    var buffer;

    if (str instanceof Buffer) {
      buffer = str;
    } else {
      buffer = Buffer.from(str.toString(), 'binary');
    }

    return buffer.toString('base64');
}

function atob(str) {
    return Buffer.from(str, 'base64').toString('binary');
}

const { addonBuilder, getInterface, getRouter } = require('stremio-addon-sdk')

if (!catalogs.length)
	catalogs.push({
		id: defaults.prefix + 'cat',
		name: defaults.name,
		type: 'tv',
		extra: [{ name: 'search' }]
	})

const metaTypes = ['tv']

if (config.style == 'Channels')
	metaTypes.push('channel')

const builder = new addonBuilder({
	id: 'org.' + defaults.name.toLowerCase().replace(/[^a-z]+/g,''),
	version: '1.0.0',
	name: defaults.name,
	description: 'Thousands of free IPTV channels from LodgeTV. Includes: English, Spanish and Arabic channels.',
	resources: ['stream', 'meta', 'catalog'],
	types: metaTypes,
	idPrefixes: [defaults.prefix],
	icon: defaults.icon,
	catalogs
})

builder.defineCatalogHandler(args => {
	return new Promise((resolve, reject) => {
		const extra = args.extra || {}

		if (config.style == 'Channels') {

			const metas = []

			for (let i = 0; types[i]; i++)
				if (types[i].m3u)
					metas.push({
						name: types[i].name,
						id: defaults.prefix + i,
						type: 'channel',
						poster: types[i].logo,
						posterShape: 'landscape',
						background: types[i].logo,
						logo: types[i].logo
					})

			if (metas.length) {
				if (extra.search) {
					let results = []
					metas.forEach(meta => {
						if (meta.name && meta.name.toLowerCase().includes(extra.search.toLowerCase()))
							results.push(meta)
					})
					if (results.length)
						resolve({ metas: results })
					else
						reject(defaults.name + ' - No search results for: ' + extra.search)
				} else
					resolve({ metas })
			} else
				reject(defaults.name + ' - No M3U URLs set')

		} else if (config.style == 'Catalogs') {

			const skip = parseInt(extra.skip || 0)
			const id = args.id.replace(defaults.prefix + 'cat_', '')

			hls.getM3U((types[id] || {}).m3u, id).then(metas => {
				if (!metas.length)
					reject(defaults.name + ' - Could not get items from M3U playlist: ' + args.id)
				else {
					if (!extra.search)
						resolve({ metas: metas.slice(skip, skip + defaults.paginate) })
					else {
						let results = []
						metas.forEach(meta => {
							if (meta.name && meta.name.toLowerCase().includes(extra.search.toLowerCase()))
								results.push(meta)
						})
						if (results.length)
							resolve({ metas: results })
						else
							reject(defaults.name + ' - No search results for: ' + extra.search)
					}
				}
			}).catch(err => {
				reject(err)
			})
		}
	})
})

builder.defineMetaHandler(args => {
	return new Promise((resolve, reject) => {
		if (config.style == 'Channels') {
			const i = args.id.replace(defaults.prefix, '')
			const meta = {
				name: types[i].name,
				id: defaults.prefix + i,
				type: 'channel',
				poster: types[i].logo,
				posterShape: 'landscape',
				background: types[i].logo,
				logo: types[i].logo
			}
			hls.getM3U(types[i].m3u).then(videos => {
				meta.videos = videos
				resolve({ meta })
			}).catch(err => {
				reject(err)
			})
		} else if (config.style == 'Catalogs') {
			const i = args.id.replace(defaults.prefix + 'url_', '').split('_')[0]
			hls.getM3U(types[i].m3u, i).then(metas => {
				let meta
				metas.some(el => {
					if (el.id == args.id) {
						meta = el
						return true
					}
				})
				if (meta)
					resolve({ meta })
				else
					reject(defaults.name + ' - Could not get meta item for: ' + args.id)
			}).catch(err => {
				reject(err)
			})
		}
	})
})

builder.defineStreamHandler(args => {
	return new Promise(async (resolve, reject) => {
		if (config.style == 'Channels') {
			const url = decodeURIComponent(args.id.replace(defaults.prefix + 'url_', ''))
			const streams = await hls.processStream(proxy.addProxy(url))
			resolve({ streams: streams || [] })
		} else if (config.style == 'Catalogs') {
			const url = atob(decodeURIComponent(args.id.replace(defaults.prefix + 'url_', '').split('_')[1]))
			const streams = await hls.processStream(proxy.addProxy(url))
			resolve({ streams: streams || [] })
		}
	})
})

const addonInterface = getInterface(builder)

module.exports = getRouter(addonInterface)
