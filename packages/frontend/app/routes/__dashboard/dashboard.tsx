import { useState, Fragment } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import { json, redirect } from '@remix-run/node'
import { useLoaderData, useActionData } from '@remix-run/react'
import { fetchWithJwt, requireJwt } from '~/lib/helpers'
import { formatEthAddress } from 'eth-address'

import { Notification } from '~/components/popovers/Notification'
import Blockies from 'react-blockies'

import cx from 'classnames'
import type { LoaderFunction, ActionFunction } from '@remix-run/node'
import type { User } from '@prisma/client'

export const loader: LoaderFunction = async ({ request }) => {
  const jwt = await requireJwt(request)

  const res = await fetchWithJwt('/auth/whoami', jwt)
  if (!res.ok) return redirect('/login')

  const data = await res.json()
  return json(data)
}

export const action: ActionFunction = async ({ request }) => {
  const jwt = await requireJwt(request)
  const form = await request.formData()
  const username = form.get('username')
  const password = form.get('password')

  if (!username || !password) return json({ formError: 'Missing fields' })

  const res = await fetch(process.env.API_BASE_URL + '/auth/eject-pk', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${jwt}`,
    },
    body: JSON.stringify({ username, password }),
  })

  const data = await res.json()

  if (data.message) return json({ formError: data.message })

  return json(data)
}

type ActionData = { privateKey?: string; formError?: string }

function Index() {
  const loaderData =
    useLoaderData<Pick<User, 'id' | 'username' | 'publicAddress'>>()
  const actionData = useActionData<ActionData>()
  const [open, setOpen] = useState(
    actionData && actionData?.formError ? true : false,
  )
  const [showSuccessCopyAddress, setShowSuccessCopyAddress] = useState(false)

  const clearCopyNotification = () => {
    setTimeout(() => setShowSuccessCopyAddress(false), 3000)
  }
  return (
    <div className='ml-16'>
      <Notification
        show={showSuccessCopyAddress}
        setShow={setShowSuccessCopyAddress}
        data={{
          type: 'success',
          header: 'Success!',
          description: `address ${formatEthAddress(
            loaderData.publicAddress,
          )} copied to clipboard`,
        }}
      />
      <div className='mx-auto mt-10 max-w-7xl p-6'>
        {/* TODO: This blockie is giving a warning (componenWillUpdate) */}
        <Blockies
          size={10}
          scale={10}
          seed={loaderData.publicAddress}
          className='rounded-lg bg-white p-1 shadow-sm'
        />

        <p className='mt-3 text-3xl font-semibold'>{loaderData.username}</p>
        <div className='mt-1 flex'>
          <div className='flex rounded-md border-2 border-white bg-white'>
            <button
              onClick={() => {
                navigator.clipboard
                  .writeText(loaderData.publicAddress)
                  .then(() => setShowSuccessCopyAddress(true))
                  .finally(clearCopyNotification)
              }}
              className='flex items-center px-3 py-2 text-sm font-semibold uppercase hover:opacity-60'>
              <img src='/ethLogo.png' alt='eth logo' className='mr-2 h-4 w-2' />
              {formatEthAddress(loaderData.publicAddress)}
            </button>
            <button
              className='rounded-r-md bg-gray-100 px-3 py-2 text-sm font-semibold hover:brightness-95'
              onClick={() => setOpen(true)}>
              Retrieve Private Key
            </button>
          </div>
        </div>
        {actionData && actionData.privateKey && (
          <p>Private Key: {actionData.privateKey}</p>
        )}
      </div>
      <Transition.Root show={open} as={Fragment}>
        <Dialog as='div' className='relative z-10' onClose={setOpen}>
          <Transition.Child
            as={Fragment}
            enter='ease-out duration-300'
            enterFrom='opacity-0'
            enterTo='opacity-100'
            leave='ease-in duration-200'
            leaveFrom='opacity-100'
            leaveTo='opacity-0'>
            <div className='fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity' />
          </Transition.Child>

          <div className='fixed inset-0 z-10 overflow-y-auto'>
            <div className='flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0'>
              <Transition.Child
                as={Fragment}
                enter='ease-out duration-300'
                enterFrom='opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95'
                enterTo='opacity-100 translate-y-0 sm:scale-100'
                leave='ease-in duration-200'
                leaveFrom='opacity-100 translate-y-0 sm:scale-100'
                leaveTo='opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95'>
                <Dialog.Panel className='relative transform overflow-hidden rounded-lg bg-white px-4 pt-5 pb-4 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-sm sm:p-6'>
                  <div>
                    <div className='mt-3 text-left sm:mt-5'>
                      <Dialog.Title
                        as='h3'
                        className='text-center text-lg font-medium leading-6 text-gray-900'>
                        Provide Your Credentials
                      </Dialog.Title>
                      <form
                        method='post'
                        action='/dashboard?index'
                        className='mt-2'>
                        <div>
                          <label
                            htmlFor='username'
                            className='block text-sm font-medium text-gray-700'>
                            Username
                          </label>
                          <div className='mt-1'>
                            <input
                              type='text'
                              name='username'
                              id='username'
                              className={cx(
                                'border border-gray-300 focus:border-indigo-500 focus:ring-indigo-500',
                                'block w-full rounded-md p-1 shadow-sm sm:text-sm',
                              )}
                              placeholder='JohnDoe'
                            />
                          </div>
                        </div>
                        <div className='mt-1'>
                          <label
                            htmlFor='password'
                            className='block text-sm font-medium text-gray-700'>
                            Password
                          </label>
                          <div className='mt-1'>
                            <input
                              type='password'
                              name='password'
                              id='password'
                              className={cx(
                                'border border-gray-300 focus:border-indigo-500 focus:ring-indigo-500',
                                'block w-full rounded-md p-1 shadow-sm sm:text-sm',
                              )}
                              placeholder='**********'
                            />
                          </div>
                        </div>
                        <div className='mt-5 sm:mt-6'>
                          <button
                            onClick={() => setOpen(false)}
                            className='inline-flex w-full justify-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-base font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-offset-2 sm:text-sm'>
                            Retrieve
                          </button>
                        </div>
                      </form>
                    </div>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition.Root>
    </div>
  )
}

export default Index
