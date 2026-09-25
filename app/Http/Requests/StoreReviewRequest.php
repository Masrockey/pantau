<?php

namespace App\Http\Requests;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class StoreReviewRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'dealer_id' => ['required', 'integer', 'exists:dealers,id'],
            'nama_reviewer' => ['required', 'string', 'max:255'],
            'tanggal_publish_review' => ['required', 'date'],
            'star_rate' => ['required', 'numeric', 'between:1,5'],
            'review' => ['nullable', 'string', 'max:10000'],
            'respon_from_owner' => ['boolean'],
            'tanggal_respon' => ['nullable', 'date'],
            'respon' => ['nullable', 'string', 'max:10000'],
            'google_review_url' => ['nullable', 'string', 'max:2000'],
        ];
    }

    /**
     * Get custom attributes for validator errors.
     *
     * @return array<string, string>
     */
    public function attributes(): array
    {
        return [
            'dealer_id' => 'dealer',
            'nama_reviewer' => 'nama reviewer',
            'tanggal_publish_review' => 'tanggal publish review',
            'star_rate' => 'star rate',
            'review' => 'review',
            'respon_from_owner' => 'respon from owner',
            'tanggal_respon' => 'tanggal respon',
            'respon' => 'respon',
            'google_review_url' => 'Google Review URL',
        ];
    }
}
